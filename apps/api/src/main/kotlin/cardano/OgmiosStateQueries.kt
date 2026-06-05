package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.*

// Raw JSON element (may be object or array) — for queries that return arrays
typealias JsonResult = JsonElement

/** Convert http(s):// → ws(s):// so Ktor's WebSocket client can connect. */
private fun String.toWsUrl() = replace(Regex("^https://"), "wss://").replace(Regex("^http://"), "ws://")

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

class OgmiosStateQueries(private val network: Network) {

    private val ogmiosUrl = when (network) {
        Network.PREPROD -> (System.getenv("OGMIOS_PREPROD_URL") ?: "ws://localhost:1337").toWsUrl()
        Network.MAINNET -> (System.getenv("OGMIOS_MAINNET_URL") ?: error("OGMIOS_MAINNET_URL not set")).toWsUrl()
    }

    private val client = HttpClient(CIO) {
        install(WebSockets)
    }

    suspend fun getGovernanceActions(): JsonObject {
        return query("queryLedgerState/governanceActions", buildJsonObject {})
    }

    suspend fun getDelegateRepresentatives(): JsonObject {
        return query("queryLedgerState/delegateRepresentatives", buildJsonObject {})
    }

    suspend fun getTreasury(): JsonObject {
        return query("queryLedgerState/treasury", buildJsonObject {})
    }

    suspend fun getProtocolParameters(): JsonObject {
        return query("queryLedgerState/protocolParameters", buildJsonObject {})
    }

    /**
     * Query a specific DRep by ID (bech32 drep1... or hex credential hash).
     * Ogmios 6.x requires the credential as a plain hex string in the keys array.
     * Returns the raw Ogmios result array (includes abstain/noConfidence entries).
     */
    suspend fun getDRepByIdRaw(drepId: String): JsonElement {
        val credentialHex = drepIdToCredentialHex(drepId)
        val params = buildJsonObject {
            putJsonArray("keys") { add(credentialHex) }
        }
        return queryRaw("queryLedgerState/delegateRepresentatives", params)
    }

    /**
     * Query stake address delegation info (Conway era).
     * Method: queryLedgerState/rewardAccountSummaries
     * Keys: array of bech32 stake addresses (stake1u...)
     */
    suspend fun getStakeDelegation(stakeAddress: String): JsonElement {
        val params = buildJsonObject {
            putJsonArray("keys") { add(stakeAddress) }
        }
        return queryRaw("queryLedgerState/rewardAccountSummaries", params)
    }

    // -------------------------------------------------------------------------

    private suspend fun query(method: String, params: JsonObject): JsonObject {
        val result = queryRaw(method, params)
        return result.jsonObject
    }

    private suspend fun queryRaw(method: String, params: JsonObject): JsonElement {
        var result: JsonElement = buildJsonObject {}
        client.webSocket(ogmiosUrl) {
            val request = buildJsonObject {
                put("jsonrpc", "2.0")
                put("method", method)
                put("params", params)
                put("id", "tempo-${System.currentTimeMillis()}")
            }
            send(Frame.Text(request.toString()))

            val response = incoming.receive() as Frame.Text
            val json = Json.parseToJsonElement(response.readText()).jsonObject
            result = json["result"] ?: buildJsonObject {}
        }
        return result
    }
}
