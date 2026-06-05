package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.withTimeout
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

private const val WS_TIMEOUT_MS = 20_000L

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
     * Returns the raw Ogmios result array (includes abstain/noConfidence entries).
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
     * Get stake delegation AND the delegated DRep's info in a SINGLE WebSocket session.
     * Avoids opening two separate connections for the common "who is this wallet delegated to?" flow.
     * Returns (delegationResult, drepInfoResult?) — drepInfoResult is null if not delegated to a registered DRep.
     */
    suspend fun getStakeDelegationWithDRepInfo(stakeAddress: String): Pair<JsonElement, JsonElement?> {
        var stakeDelegation: JsonElement = JsonArray(emptyList())
        var drepInfo: JsonElement? = null

        withTimeout(WS_TIMEOUT_MS) {
            client.webSocket(ogmiosUrl) {
                // Query 1: stake delegation
                send(Frame.Text(buildRequest("queryLedgerState/rewardAccountSummaries", buildJsonObject {
                    putJsonArray("keys") { add(stakeAddress) }
                }).toString()))
                val res1 = incoming.receive() as Frame.Text
                stakeDelegation = Json.parseToJsonElement(res1.readText()).jsonObject["result"]
                    ?: JsonArray(emptyList())

                // Extract delegated DRep credential hex.
                // Ogmios 6.x returns rewardAccountSummaries as a JsonObject keyed by stake address,
                // not a JsonArray — handle both formats defensively.
                // Capture into val so Kotlin can smart-cast (stakeDelegation is a var in a closure).
                val delegation = stakeDelegation
                val accountInfo = when {
                    delegation is JsonArray -> delegation.firstOrNull()?.jsonObject
                    delegation is JsonObject -> delegation[stakeAddress]?.jsonObject
                        ?: delegation.values.firstOrNull()?.jsonObject
                    else -> null
                }
                val drepCredentialHex = accountInfo?.let { info ->
                    val delegate = info["delegateRepresentative"]?.jsonObject
                    if (delegate?.get("type")?.jsonPrimitive?.contentOrNull == "registered") {
                        delegate["id"]?.jsonPrimitive?.contentOrNull
                    } else null
                }

                // Query 2: DRep details — reuse same WS session
                if (drepCredentialHex != null) {
                    send(Frame.Text(buildRequest("queryLedgerState/delegateRepresentatives", buildJsonObject {
                        putJsonArray("keys") { add(drepCredentialHex) }
                    }).toString()))
                    val res2 = incoming.receive() as Frame.Text
                    drepInfo = Json.parseToJsonElement(res2.readText()).jsonObject["result"]
                }
            }
        }
        return Pair(stakeDelegation, drepInfo)
    }

    // -------------------------------------------------------------------------

    private suspend fun query(method: String, params: JsonObject): JsonObject {
        return queryRaw(method, params).jsonObject
    }

    private suspend fun queryRaw(method: String, params: JsonObject): JsonElement {
        var result: JsonElement = buildJsonObject {}
        withTimeout(WS_TIMEOUT_MS) {
            client.webSocket(ogmiosUrl) {
                send(Frame.Text(buildRequest(method, params).toString()))
                val response = incoming.receive() as Frame.Text
                result = Json.parseToJsonElement(response.readText()).jsonObject["result"]
                    ?: buildJsonObject {}
            }
        }
        return result
    }

    private fun buildRequest(method: String, params: JsonObject) = buildJsonObject {
        put("jsonrpc", "2.0")
        put("method", method)
        put("params", params)
        put("id", "tempo-${System.currentTimeMillis()}")
    }
}
