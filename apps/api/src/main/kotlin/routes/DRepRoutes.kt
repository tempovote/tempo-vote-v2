package vote.tempo.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.*
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.cardano.networkFromString

private val httpClient = HttpClient(CIO)

/**
 * GET /dreps/{drepId}?network=mainnet
 * → { isRegistered, id, name, anchorUrl }
 *
 * GET /stake/{stakeAddress}/delegation?network=mainnet
 * → { delegatedDrep: { id, name } | null }
 */
fun Route.drepRoutes() {
    route("/dreps") {

        // GET /dreps?network=mainnet — list all registered DReps
        get {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val queries = OgmiosStateQueries(network)
            val result = queries.getDelegateRepresentatives()
            call.respond(result)
        }

        // GET /dreps/{drepId}?network=mainnet
        get("/{drepId}") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(mapOf("error" to "drepId required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val queries = OgmiosStateQueries(network)

            try {
                val raw = queries.getDRepByIdRaw(drepId)

                // Ogmios returns an array — may include abstain/noConfidence special entries
                val drepsArray: JsonArray = when {
                    raw is JsonArray -> raw
                    raw is JsonObject && raw["delegateRepresentatives"] is JsonArray ->
                        raw["delegateRepresentatives"]!!.jsonArray
                    else -> JsonArray(emptyList())
                }

                // Only consider entries of type "registered" (skip abstain/noConfidence)
                val registeredDrep = drepsArray
                    .mapNotNull { it.jsonObject }
                    .firstOrNull { it["type"]?.jsonPrimitive?.contentOrNull == "registered" }

                if (registeredDrep == null) {
                    call.respond(buildJsonObject {
                        put("isRegistered", false)
                        put("id", drepId)
                        put("name", JsonNull)
                        put("anchorUrl", JsonNull)
                    })
                    return@get
                }

                val drep = registeredDrep
                // Ogmios 6.x: anchor URL is at drep.metadata.url
                val anchorUrl = drep["metadata"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                    ?: drep["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull

                val drepName = anchorUrl?.let { fetchDRepName(it) }

                call.respond(buildJsonObject {
                    put("isRegistered", true)
                    put("id", drepId)
                    put("name", drepName?.let { JsonPrimitive(it) } ?: JsonNull)
                    put("anchorUrl", anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                })
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, buildJsonObject {
                    put("error", e.message ?: "Ogmios query failed")
                })
            }
        }
    }
}

fun Route.stakeRoutes() {
    route("/stake") {

        // GET /stake/{stakeAddress}/delegation?network=mainnet
        // Returns which DRep this stake address has delegated voting power to.
        get("/{stakeAddress}/delegation") {
            val stakeAddress = call.parameters["stakeAddress"]
                ?: return@get call.respond(mapOf("error" to "stakeAddress required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val queries = OgmiosStateQueries(network)

            try {
                val raw = queries.getStakeDelegation(stakeAddress)

                // Ogmios 6.x rewardAccountSummaries response is an array:
                // [{ "credential": "hex", "delegateRepresentative": { "type": "registered", "id": "hex" }, ... }]
                val accountInfo = when {
                    raw is JsonArray -> raw.firstOrNull()?.jsonObject
                    raw is JsonObject -> raw[stakeAddress]?.jsonObject
                        ?: raw.values.firstOrNull()?.jsonObject
                    else -> null
                }

                // DRep delegation is at delegateRepresentative.id (hex credential hash)
                val drepId = accountInfo?.let { info ->
                    val delegate = info["delegateRepresentative"]?.jsonObject
                    if (delegate?.get("type")?.jsonPrimitive?.contentOrNull == "registered") {
                        delegate["id"]?.jsonPrimitive?.contentOrNull
                    } else null
                }

                if (drepId == null) {
                    call.respond(buildJsonObject { put("delegatedDrep", JsonNull) })
                    return@get
                }

                // Optionally fetch the DRep's name via its anchor metadata
                val drepName = try {
                    val drepRaw = queries.getDRepByIdRaw(drepId)
                    val drepsArr = when {
                        drepRaw is JsonArray -> drepRaw
                        drepRaw is JsonObject && drepRaw["delegateRepresentatives"] is JsonArray ->
                            drepRaw["delegateRepresentatives"]!!.jsonArray
                        else -> JsonArray(emptyList())
                    }
                    val registeredEntry = drepsArr.mapNotNull { it.jsonObject }
                        .firstOrNull { it["type"]?.jsonPrimitive?.contentOrNull == "registered" }
                    val anchorUrl = registeredEntry
                        ?.let { it["metadata"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                            ?: it["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull }
                    anchorUrl?.let { fetchDRepName(it) }
                } catch (_: Exception) { null }

                call.respond(buildJsonObject {
                    putJsonObject("delegatedDrep") {
                        put("id", drepId)
                        put("name", drepName?.let { JsonPrimitive(it) } ?: JsonNull)
                    }
                })
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, buildJsonObject {
                    put("error", e.message ?: "Ogmios query failed")
                })
            }
        }
    }
}

/**
 * Fetch DRep metadata from anchor URL and extract the given name.
 * Supports CIP-119 format: { body: { givenName: "..." } }
 * Falls back to top-level "givenName" or "name" fields.
 */
private suspend fun fetchDRepName(anchorUrl: String): String? {
    return try {
        val response = httpClient.get(anchorUrl)
        val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
        json["body"]?.jsonObject?.get("givenName")?.jsonPrimitive?.contentOrNull
            ?: json["givenName"]?.jsonPrimitive?.contentOrNull
            ?: json["name"]?.jsonPrimitive?.contentOrNull
    } catch (_: Exception) {
        null
    }
}
