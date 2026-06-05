package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.websocket.*
import io.ktor.websocket.*
import kotlinx.serialization.json.*

// Raw JSON element (may be object or array) — for queries that return arrays
typealias JsonResult = JsonElement

/**
 * OgmiosStateQueries — direct WebSocket queries to Ogmios for on-chain governance data.
 *
 * These queries are OUTSIDE the scope of KupmiosBackendService (which focuses on
 * tx building). We query Ogmios directly for:
 *   - Governance Actions list
 *   - DRep list + info
 *   - Treasury balance
 *   - Protocol parameters (also available via backendService but duplicated here for direct access)
 *
 * Ogmios JSON-RPC WebSocket protocol: https://ogmios.dev/api/
 */
class OgmiosStateQueries(private val network: Network) {

    private val ogmiosUrl = when (network) {
        Network.PREPROD -> System.getenv("OGMIOS_PREPROD_URL") ?: "ws://localhost:1337"
        Network.MAINNET -> System.getenv("OGMIOS_MAINNET_URL") ?: error("OGMIOS_MAINNET_URL not set")
    }

    private val client = HttpClient(CIO) {
        install(WebSockets)
    }

    /**
     * Query all governance actions from Ogmios.
     * Method: queryLedgerState/governanceActions
     */
    suspend fun getGovernanceActions(): JsonObject {
        return query("queryLedgerState/governanceActions", buildJsonObject {})
    }

    /**
     * Query all registered DReps.
     * Method: queryLedgerState/delegateRepresentatives
     */
    suspend fun getDelegateRepresentatives(): JsonObject {
        return query("queryLedgerState/delegateRepresentatives", buildJsonObject {})
    }

    /**
     * Query a specific DRep by ID.
     */
    suspend fun getDRepById(drepId: String): JsonObject {
        val params = buildJsonObject {
            putJsonArray("keys") { add(buildJsonObject { put("id", drepId) }) }
        }
        return query("queryLedgerState/delegateRepresentatives", params)
    }

    /**
     * Query treasury value (lovelace).
     * Method: queryLedgerState/treasury
     */
    suspend fun getTreasury(): JsonObject {
        return query("queryLedgerState/treasury", buildJsonObject {})
    }

    /**
     * Query current protocol parameters.
     */
    suspend fun getProtocolParameters(): JsonObject {
        return query("queryLedgerState/protocolParameters", buildJsonObject {})
    }

    /**
     * Query a specific DRep by ID, returning the raw JsonElement result.
     * Ogmios returns an array of matching DRep objects.
     */
    suspend fun getDRepByIdRaw(drepId: String): JsonElement {
        val params = buildJsonObject {
            putJsonArray("keys") { add(buildJsonObject { put("id", drepId) }) }
        }
        return queryRaw("queryLedgerState/delegateRepresentatives", params)
    }

    /**
     * Query stake address delegation info (Conway era).
     * Returns DRep delegation and pool delegation for the given stake address.
     * Method: queryLedgerState/rewardAccountSummaries
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

    /** Like query() but returns JsonElement — handles both array and object results. */
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
