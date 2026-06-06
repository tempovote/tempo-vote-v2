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
