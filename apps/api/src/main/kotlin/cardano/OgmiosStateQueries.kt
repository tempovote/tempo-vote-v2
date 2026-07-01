package vote.tempo.cardano

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*

private val ogmiosLogger = KotlinLogging.logger("OgmiosStateQueries")

// Raw JSON element (may be object or array)
typealias JsonResult = JsonElement

/**
 * Decode a bech32 DRep ID (drep1...) to its raw 28-byte credential hash in hex.
 * Ogmios 6.x requires the hex credential hash as a plain string for DRep key filters.
 * If the input is already a 56-char hex string, it's returned as-is.
 */
fun drepIdToCredentialHex(drepId: String): String {
    if (!drepId.startsWith("drep")) return drepId  // already hex credential

    val ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    val lower = drepId.lowercase()
    val sep = lower.lastIndexOf('1')
    val dataChars = lower.substring(sep + 1).dropLast(6)  // strip 6-char checksum

    val fiveBits = dataChars.map { c ->
        ALPHABET.indexOf(c).also { check(it >= 0) { "Invalid bech32 char: $c" } }
    }

    val bytes = mutableListOf<Int>()
    var acc = 0
    var bits = 0
    for (value in fiveBits) {
        acc = (acc shl 5) or value
        bits += 5
        if (bits >= 8) {
            bits -= 8
            bytes.add((acc shr bits) and 0xff)
        }
    }
    // CIP-129: DRep IDs may have a 1-byte type header (0x22 = keyHash, 0x23 = script)
    // followed by the 28-byte credential. Strip the header so the result is always 56 hex chars.
    val credential = if (bytes.size == 29 && (bytes[0] == 0x22 || bytes[0] == 0x23)) {
        bytes.drop(1)
    } else {
        bytes
    }
    return credential.joinToString("") { "%02x".format(it) }
}

private const val BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
private val BECH32_GEN = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)

private fun bech32Polymod(values: List<Int>): Int {
    var chk = 1
    for (v in values) {
        val b = chk ushr 25
        chk = ((chk and 0x1ffffff) shl 5) xor v
        for (i in 0..4) if ((b ushr i) and 1 != 0) chk = chk xor BECH32_GEN[i]
    }
    return chk
}

private fun bech32CreateChecksum(hrp: String, data: List<Int>): List<Int> {
    val values = hrp.map { it.code ushr 5 } + listOf(0) + hrp.map { it.code and 31 } + data + listOf(0, 0, 0, 0, 0, 0)
    val polymod = bech32Polymod(values) xor 1
    return (0..5).map { (polymod ushr (5 * (5 - it))) and 31 }
}

private fun bytesToBech32Words(bytes: ByteArray): List<Int> {
    val words = mutableListOf<Int>()
    var acc = 0; var bits = 0
    for (b in bytes) {
        acc = (acc shl 8) or (b.toInt() and 0xFF); bits += 8
        while (bits >= 5) { bits -= 5; words.add((acc ushr bits) and 0x1F) }
    }
    if (bits > 0) words.add((acc shl (5 - bits)) and 0x1F)
    return words
}

private fun bech32Encode(hrp: String, words: List<Int>): String {
    val combined = words + bech32CreateChecksum(hrp, words)
    return hrp + "1" + combined.joinToString("") { BECH32_ALPHABET[it].toString() }
}

/** Convert a 28-byte hex pool ID to bech32 "pool1..." format. */
fun poolIdHexToBech32(hexId: String): String {
    val bytes = hexId.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    return bech32Encode("pool", bytesToBech32Words(bytes))
}

/** Convert a governance action (txHash hex + index) to bech32 "gov_action1..." format. */
fun txHashToGovActionId(txHash: String, index: Int): String {
    val txHashBytes = txHash.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val data = txHashBytes + byteArrayOf(index.toByte())
    return bech32Encode("gov_action", bytesToBech32Words(data))
}

/**
 * CIP-129 cold committee credential (28-byte hash hex) → bech32 "cc_cold1...".
 * Header byte = key-type (CC Cold = 0b0001) << 4 | credential-type (key 0b0010 / script 0b0011),
 * i.e. 0x12 for a key hash and 0x13 for a script hash. Falls back to the raw hex on bad input.
 */
fun ccColdCredentialToBech32(hashHex: String, isScript: Boolean): String = runCatching {
    val header = if (isScript) 0x13 else 0x12
    val bytes = byteArrayOf(header.toByte()) + hashHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    bech32Encode("cc_cold", bytesToBech32Words(bytes))
}.getOrDefault(hashHex)

/**
 * Construct a bech32 stake address from a 28-byte credential hex.
 * Assumes the DRep credential is the same as the wallet's stake key credential —
 * valid for typical CIP-30/CIP-95 wallet registrations.
 * Returns null if the credential hex is invalid.
 */
fun credentialHexToStakeAddress(credentialHex: String, network: Network): String? {
    return runCatching {
        val credBytes = credentialHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        check(credBytes.size == 28) { "Expected 28 credential bytes, got ${credBytes.size}" }
        val header = if (network == Network.MAINNET) 0xE1.toByte() else 0xE0.toByte()
        val payload = byteArrayOf(header) + credBytes
        val hrp = if (network == Network.MAINNET) "stake" else "stake_test"
        bech32Encode(hrp, bytesToBech32Words(payload))
    }.getOrNull()
}

/**
 * Reverse of credentialHexToStakeAddress: decode a bech32 stake address back to its
 * 28-byte credential hex.  The first byte after bech32 decode is the network header
 * (0xE0 testnet / 0xE1 mainnet) — we strip it to return the raw 28-byte credential.
 * Returns null if the input is not a valid stake address.
 */
fun stakeAddressToCredentialHex(stakeAddress: String): String? = runCatching {
    val lower = stakeAddress.lowercase()
    val sep   = lower.lastIndexOf('1')
    val dataChars = lower.substring(sep + 1).dropLast(6)   // strip 6-char checksum

    val fiveBits = dataChars.map { c ->
        BECH32_ALPHABET.indexOf(c).also { check(it >= 0) }
    }
    val bytes = mutableListOf<Int>()
    var acc = 0; var bits = 0
    for (v in fiveBits) {
        acc = (acc shl 5) or v; bits += 5
        if (bits >= 8) { bits -= 8; bytes.add((acc shr bits) and 0xff) }
    }
    // bytes[0] is the network header; drop it to get the 28-byte credential
    check(bytes.size == 29)
    bytes.drop(1).joinToString("") { "%02x".format(it) }
}.getOrNull()

/**
 * Convert a 28-byte credential hex to a CIP-105 bech32 DRep ID (drep1...).
 * This is the canonical display format — no type-header byte, just the raw credential.
 * Returns null if the hex is malformed.
 */
fun credentialHexToDrepIdCip105(credentialHex: String): String? =
    runCatching {
        val credBytes = credentialHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        check(credBytes.size == 28) { "Expected 28 credential bytes, got ${credBytes.size}" }
        bech32Encode("drep", bytesToBech32Words(credBytes))
    }.getOrNull()

private const val HTTP_TIMEOUT_MS = 20_000L
// delegateRepresentatives returns ~8 MB on mainnet (10k+ DReps) and takes ~2 min to download.
private const val HEAVY_QUERY_TIMEOUT_MS = 300_000L
// governanceProposals grows with the number of active votes — on mainnet with thousands of DRep
// votes per proposal, the response can easily exceed 20 s. Use a 2-min cap like other large queries.
private const val GOV_PROPOSALS_TIMEOUT_MS = 120_000L

class OgmiosStateQueries(private val network: Network) {

    // Ogmios 6.x exposes JSON-RPC over HTTP (same URL as WebSocket) — prefer HTTP
    // for ledger state queries; WebSocket is only needed for chain-sync subscriptions.
    private val ogmiosUrl = when (network) {
        Network.PREPROD -> System.getenv("OGMIOS_PREPROD_URL") ?: "http://localhost:1337"
        Network.MAINNET -> System.getenv("OGMIOS_MAINNET_URL") ?: error("OGMIOS_MAINNET_URL not set")
    }

    private val kupoUrl = when (network) {
        Network.PREPROD -> System.getenv("KUPO_PREPROD_URL") ?: "http://localhost:1442"
        Network.MAINNET -> System.getenv("KUPO_MAINNET_URL") ?: error("KUPO_MAINNET_URL not set")
    }

    companion object {
        private val client = HttpClient(CIO) {
            install(ContentNegotiation) { json() }
            engine {
                // Disable the CIO engine's own request timeout so it does not race against
                // the per-query withTimeout() in queryRaw(). Without this, CIO fires its
                // ~15 s socket-idle timeout while Ogmios is still processing large responses
                // (e.g. delegateRepresentatives, 1.5 MB on mainnet), killing the request
                // before withTimeout(HEAVY_QUERY_TIMEOUT_MS) even gets a chance to fire.
                requestTimeout = 0
            }
        }
        private val json = Json { ignoreUnknownKeys = true }
    }

    suspend fun getGovernanceProposals(): JsonElement {
        return queryRaw("queryLedgerState/governanceProposals", buildJsonObject {}, GOV_PROPOSALS_TIMEOUT_MS)
    }

    /**
     * Resolve the last *enacted* governance action id for a chained purpose
     * (protocolParametersUpdate, hardForkInitiation, constitutional committee, constitution).
     *
     * CIP-1694 requires these proposals to point to the most recently ratified action of the
     * same purpose via `prevGovActionId`. The ledger keeps that pointer as the *root* of the
     * proposal tree. Ogmios doesn't expose the pointer directly, but every pending proposal of
     * the purpose carries its own `ancestor` (the prevGovActionId it was built against). The
     * one ancestor that is NOT itself a pending proposal is the enacted root.
     *
     * @param actionTypes ogmios `action.type` values that share one purpose pointer
     *   (e.g. ["constitutionalCommittee", "noConfidence"] both map to the Committee purpose).
     * @return (txHash, index) of the last enacted action, or null when it cannot be derived
     *   (no pending proposal of this purpose exists — caller should fall back to null/manual).
     */
    suspend fun getLastEnactedGovActionId(vararg actionTypes: String): Pair<String, Int>? {
        val proposals = getGovernanceProposals() as? JsonArray ?: return null
        val typeSet = actionTypes.toSet()

        fun idOf(o: JsonObject): String {
            val tx = o["transaction"]!!.jsonObject["id"]!!.jsonPrimitive.content
            val ix = o["index"]!!.jsonPrimitive.int
            return "$tx#$ix"
        }

        val pendingIds = proposals.mapNotNull { (it as? JsonObject)?.get("proposal")?.jsonObject?.let(::idOf) }.toSet()

        for (p in proposals) {
            val obj = p as? JsonObject ?: continue
            val action = obj["action"]?.jsonObject ?: continue
            if (action["type"]?.jsonPrimitive?.contentOrNull !in typeSet) continue
            val ancestor = action["ancestor"]?.takeIf { it !is JsonNull }?.jsonObject ?: continue
            val ancestorId = idOf(ancestor)
            if (ancestorId !in pendingIds) {
                val tx = ancestor["transaction"]!!.jsonObject["id"]!!.jsonPrimitive.content
                val ix = ancestor["index"]!!.jsonPrimitive.int
                return tx to ix
            }
        }
        return null
    }

    suspend fun getDelegateRepresentatives(): JsonElement {
        return queryRaw("queryLedgerState/delegateRepresentatives", buildJsonObject {}, HEAVY_QUERY_TIMEOUT_MS)
    }

    suspend fun getConstitutionalCommittee(): JsonElement {
        return queryRaw("queryLedgerState/constitutionalCommittee", buildJsonObject {})
    }

    /**
     * Returns the current constitution's guardrails script hash as raw bytes (28 bytes),
     * or null if the constitution has no guardrails script.
     * Treasury Withdrawals and ParameterChange proposals must include this hash when non-null.
     */
    suspend fun getConstitutionGuardrailsHash(): ByteArray? {
        val constitution = queryRaw("queryLedgerState/constitution", buildJsonObject {}).jsonObject
        val guardrails = constitution["guardrails"]
        if (guardrails == null || guardrails is JsonNull) return null
        val hashHex = guardrails.jsonObject["hash"]?.jsonPrimitive?.contentOrNull ?: return null
        return ByteArray(hashHex.length / 2) { i ->
            hashHex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }

    /**
     * Returns the CBOR hex of the current constitution's guardrails script (Plutus v3),
     * or null if there is no guardrails script or it cannot be fetched from Kupo.
     * Required as a witness when submitting TreasuryWithdrawal or ParameterChange proposals.
     */
    suspend fun getConstitutionScriptHex(): String? {
        val constitution = queryRaw("queryLedgerState/constitution", buildJsonObject {}).jsonObject
        val guardrails = constitution["guardrails"]
        if (guardrails == null || guardrails is JsonNull) return null
        val hashHex = guardrails.jsonObject["hash"]?.jsonPrimitive?.contentOrNull ?: return null
        return withTimeout(HTTP_TIMEOUT_MS) {
            val response = client.get("$kupoUrl/scripts/$hashHex")
            val text = response.bodyAsText()
            json.parseToJsonElement(text).jsonObject["script"]?.jsonPrimitive?.contentOrNull
        }
    }

    suspend fun getTreasury(): JsonObject {
        return queryRaw("queryLedgerState/treasury", buildJsonObject {}).jsonObject
    }

    /**
     * Get the current chain tip slot number.
     * Used to convert POSIX time to slot for TX validity intervals.
     * In Conway era, 1 slot = 1 second.
     */
    suspend fun getCurrentTipSlot(): Long {
        val result = queryRaw("queryNetwork/tip", buildJsonObject {})
        return result.jsonObject["slot"]?.jsonPrimitive?.long
            ?: error("queryNetwork/tip returned no slot")
    }

    /**
     * Convert a POSIX timestamp (ms) to an approximate chain slot.
     * Uses the current tip to establish the slot ↔ time mapping.
     * Accurate in Conway era where 1 slot = 1 second.
     */
    suspend fun posixMsToSlot(posixMs: Long): Long {
        val currentSlot = getCurrentTipSlot()
        val currentPosixMs = System.currentTimeMillis()
        val deltaSec = (posixMs - currentPosixMs) / 1000
        return currentSlot + deltaSec
    }

    data class KupoUtxo(val txHash: String, val outputIndex: Int, val lovelace: Long, val datumHash: String?)

    /**
     * Query Kupo for UTxOs at a script address.
     * Optionally filter by datum hash (blake2b-256 of the inline datum CBOR).
     * Use PlutusData.getDatumHash() to compute the expected hash for filtering.
     */
    suspend fun getScriptUtxos(scriptAddress: String, filterDatumHash: String? = null): List<KupoUtxo> {
        return withContext(Dispatchers.IO) {
            val response = client.get("$kupoUrl/matches/$scriptAddress?unspent")
            val text = response.bodyAsText()
            val arr = json.parseToJsonElement(text).jsonArray
            arr.mapNotNull { elem ->
                val obj = elem.jsonObject
                val txHash = obj["transaction_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
                val idx = obj["output_index"]?.jsonPrimitive?.int ?: return@mapNotNull null
                val coins = obj["value"]?.jsonObject?.get("coins")?.jsonPrimitive?.long ?: 0L
                val datumHash = obj["datum_hash"]?.jsonPrimitive?.content
                KupoUtxo(txHash, idx, coins, datumHash)
            }.filter { filterDatumHash == null || it.datumHash == filterDatumHash }
        }
    }

    /**
     * Reconstruct the alliance's contribution history from Kupo — including outputs already spent
     * by later withdrawals. Needed because the treasury address holds BOTH contributions and the
     * change-back outputs of withdrawals (same address + datum), so a live-UTxO view can't tell
     * them apart and would mislabel withdrawal change as a contribution.
     *
     * Classification (DB-free, robust): a treasury output is CHANGE iff its creating transaction
     * also SPENT a treasury UTxO of this alliance (a withdrawal consumes a treasury UTxO and pays
     * change back). A pure contribution pays in from a wallet and spends no treasury UTxO. So the
     * set of "spender" tx hashes = every output's spent_at.transaction_id; any output whose own
     * creating tx is in that set is change and is excluded.
     *
     * Returns real contributions (spent or unspent), newest first.
     */
    suspend fun getScriptContributions(scriptAddress: String, filterDatumHash: String? = null): List<KupoUtxo> {
        return withContext(Dispatchers.IO) {
            val response = client.get("$kupoUrl/matches/$scriptAddress")  // all matches: spent + unspent
            val text = response.bodyAsText()
            val arr = json.parseToJsonElement(text).jsonArray

            data class Match(val utxo: KupoUtxo, val createdSlot: Long, val spentByTx: String?)
            val matches = arr.mapNotNull { elem ->
                val obj = elem.jsonObject
                val txHash = obj["transaction_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
                val idx = obj["output_index"]?.jsonPrimitive?.int ?: return@mapNotNull null
                val coins = obj["value"]?.jsonObject?.get("coins")?.jsonPrimitive?.long ?: 0L
                val datumHash = obj["datum_hash"]?.jsonPrimitive?.content
                // spent_at is `null` (JsonNull) for unspent matches — use `as?` so a JsonNull
                // doesn't throw on .jsonObject. created_at is always an object but guard it too.
                val createdSlot = (obj["created_at"] as? JsonObject)?.get("slot_no")?.jsonPrimitive?.long ?: 0L
                val spentByTx = (obj["spent_at"] as? JsonObject)?.get("transaction_id")?.jsonPrimitive?.content
                Match(KupoUtxo(txHash, idx, coins, datumHash), createdSlot, spentByTx)
            }.filter { filterDatumHash == null || it.utxo.datumHash == filterDatumHash }

            val spenderTxs = matches.mapNotNull { it.spentByTx }.toSet()
            matches.filter { it.utxo.txHash !in spenderTxs }
                .sortedByDescending { it.createdSlot }
                .map { it.utxo }
        }
    }

    /**
     * Evaluate a transaction via Ogmios to get actual execution units for each script.
     * Returns a map from "purpose:index" (e.g. "spend:0") to (mem, cpu) pair.
     * Throws on evaluation failure (script error) so the caller can propagate the error.
     */
    suspend fun evaluateTx(txCbor: String): Map<String, Pair<Long, Long>> {
        val result = queryRaw("evaluateTx", buildJsonObject {
            putJsonObject("transaction") { put("cbor", txCbor) }
            putJsonArray("additionalUtxo") {}
        }, timeoutMs = 30_000L)

        if (result is JsonArray) {
            return result.associate { elem ->
                val obj = elem.jsonObject
                val validator = obj["validator"]?.jsonObject
                val purpose = validator?.get("purpose")?.jsonPrimitive?.content ?: "unknown"
                val index = validator?.get("index")?.jsonPrimitive?.int ?: 0
                val budget = obj["budget"]?.jsonObject
                val mem  = budget?.get("memory")?.jsonPrimitive?.long ?: 0L
                val cpu  = budget?.get("cpu")?.jsonPrimitive?.long ?: 0L
                "$purpose:$index" to (mem to cpu)
            }
        }
        // Ogmios returned an error (JSON-RPC error response) or unexpected shape — log full body
        ogmiosLogger.warn { "evaluateTx: Ogmios returned non-array result: ${result.toString().take(500)}" }
        return emptyMap()
    }

    suspend fun getProtocolParameters(): JsonObject {
        return queryRaw("queryLedgerState/protocolParameters", buildJsonObject {}).jsonObject
    }

    /**
     * Query a specific DRep by ID (bech32 drep1... or hex credential hash).
     */
    suspend fun getDRepByIdRaw(drepId: String): JsonElement {
        val credentialHex = drepIdToCredentialHex(drepId)
        return queryRaw("queryLedgerState/delegateRepresentatives", buildJsonObject {
            putJsonArray("keys") { add(credentialHex) }
        })
    }

    suspend fun getStakeDelegation(stakeAddress: String): JsonElement {
        return queryRaw("queryLedgerState/rewardAccountSummaries", buildJsonObject {
            putJsonArray("keys") { add(stakeAddress) }
        })
    }

    /**
     * True if the stake credential behind a bech32 reward/stake address is registered
     * on-chain. Conway proposals refund their deposit to this account, which the ledger
     * requires to be registered (else submit fails with error 3146). A registered account
     * has a rewardAccountSummaries entry; an unregistered one does not.
     * Throws on query failure — the caller decides whether to fail open.
     */
    suspend fun isStakeRegistered(stakeAddress: String): Boolean {
        val raw = getStakeDelegation(stakeAddress)
        val accountInfo = when (raw) {
            is JsonArray  -> raw.firstOrNull()?.jsonObject
            is JsonObject -> raw[stakeAddress]?.jsonObject ?: raw.values.firstOrNull()?.jsonObject
            else          -> null
        }
        return accountInfo != null
    }

    /**
     * Fetch stake delegation and delegated DRep info via two separate HTTP calls.
     * Returns (delegationResult, drepInfoResult?) — drepInfoResult is null if not
     * delegated to a registered DRep.
     */
    suspend fun getCurrentEpoch(): Int {
        val result = queryRaw("queryLedgerState/epoch", buildJsonObject {})
        return result.jsonPrimitive.int
    }

    suspend fun getStakeDelegationWithDRepInfo(stakeAddress: String): Pair<JsonElement, JsonElement?> {
        val stakeDelegation = getStakeDelegation(stakeAddress)

        val accountInfo = when {
            stakeDelegation is JsonArray -> stakeDelegation.firstOrNull()?.jsonObject
            stakeDelegation is JsonObject -> stakeDelegation[stakeAddress]?.jsonObject
                ?: stakeDelegation.values.firstOrNull()?.jsonObject
            else -> null
        }
        val drepCredentialHex = accountInfo?.let { info ->
            val delegate = info["delegateRepresentative"]?.jsonObject
            if (delegate?.get("type")?.jsonPrimitive?.contentOrNull == "registered") {
                delegate["id"]?.jsonPrimitive?.contentOrNull
            } else null
        }

        val drepInfo = if (drepCredentialHex != null) {
            queryRaw("queryLedgerState/delegateRepresentatives", buildJsonObject {
                putJsonArray("keys") { add(drepCredentialHex) }
            })
        } else null

        return Pair(stakeDelegation, drepInfo)
    }

    // -------------------------------------------------------------------------

    private suspend fun queryRaw(method: String, params: JsonObject, timeoutMs: Long = HTTP_TIMEOUT_MS): JsonElement {
        return withTimeout(timeoutMs) {
            val body = buildRequest(method, params).toString()
            val response = client.post(ogmiosUrl) {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            val text = response.bodyAsText()
            val parsed = json.parseToJsonElement(text).jsonObject
            parsed["result"] ?: run {
                if (method == "evaluateTx") {
                    ogmiosLogger.warn { "evaluateTx Ogmios response (no result field): ${text.take(600)}" }
                }
                buildJsonObject {}
            }
        }
    }

    private fun buildRequest(method: String, params: JsonObject) = buildJsonObject {
        put("jsonrpc", "2.0")
        put("method", method)
        put("params", params)
        put("id", "tempo-${System.currentTimeMillis()}")
    }
}
