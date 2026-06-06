package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*

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
    return bytes.joinToString("") { "%02x".format(it) }
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

private const val HTTP_TIMEOUT_MS = 20_000L

class OgmiosStateQueries(private val network: Network) {

    // Ogmios 6.x exposes JSON-RPC over HTTP (same URL as WebSocket) — prefer HTTP
    // for ledger state queries; WebSocket is only needed for chain-sync subscriptions.
    private val ogmiosUrl = when (network) {
        Network.PREPROD -> System.getenv("OGMIOS_PREPROD_URL") ?: "http://localhost:1337"
        Network.MAINNET -> System.getenv("OGMIOS_MAINNET_URL") ?: error("OGMIOS_MAINNET_URL not set")
    }

    companion object {
        private val client = HttpClient(CIO) {
            install(ContentNegotiation) { json() }
        }
        private val json = Json { ignoreUnknownKeys = true }
    }

    suspend fun getGovernanceProposals(): JsonElement {
        return queryRaw("queryLedgerState/governanceProposals", buildJsonObject {})
    }

    suspend fun getDelegateRepresentatives(): JsonElement {
        return queryRaw("queryLedgerState/delegateRepresentatives", buildJsonObject {})
    }

    suspend fun getTreasury(): JsonObject {
        return queryRaw("queryLedgerState/treasury", buildJsonObject {}).jsonObject
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
     * Fetch stake delegation and delegated DRep info via two separate HTTP calls.
     * Returns (delegationResult, drepInfoResult?) — drepInfoResult is null if not
     * delegated to a registered DRep.
     */
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

    private suspend fun queryRaw(method: String, params: JsonObject): JsonElement {
        return withTimeout(HTTP_TIMEOUT_MS) {
            val body = buildRequest(method, params).toString()
            val response = client.post(ogmiosUrl) {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            val text = response.bodyAsText()
            json.parseToJsonElement(text).jsonObject["result"] ?: buildJsonObject {}
        }
    }

    private fun buildRequest(method: String, params: JsonObject) = buildJsonObject {
        put("jsonrpc", "2.0")
        put("method", method)
        put("params", params)
        put("id", "tempo-${System.currentTimeMillis()}")
    }
}
