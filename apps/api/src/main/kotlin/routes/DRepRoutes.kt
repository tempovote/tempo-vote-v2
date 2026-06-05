package vote.tempo.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import vote.tempo.cache.CardanoCache
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
        // Served from CardanoCache.drepList (pre-warmed by BackgroundPoller every 5 min).
        get {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            CardanoCache.drepList.getIfPresent(network.name)?.let { cached ->
                call.respond(cached)
                return@get
            }

            val queries = OgmiosStateQueries(network)
            val result = queries.getDelegateRepresentatives()
            CardanoCache.drepList.put(network.name, result)
            call.respond(result)
        }

        // GET /dreps/{drepId}?network=mainnet
        // Served from CardanoCache.drepInfo (30-min TTL per credential).
        get("/{drepId}") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(mapOf("error" to "drepId required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            val credentialHex = drepIdToCredentialHex(drepId)
            val cacheKey = "${network.name}:$credentialHex"

            CardanoCache.drepInfo.getIfPresent(cacheKey)?.let { cached ->
                call.respond(cached)
                return@get
            }

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

                val response = if (registeredDrep == null) {
                    buildJsonObject {
                        put("isRegistered", false)
                        put("id", drepId)
                        put("name", JsonNull)
                        put("anchorUrl", JsonNull)
                    }
                } else {
                    // Ogmios 6.x: anchor URL is at drep.metadata.url
                    val anchorUrl = registeredDrep["metadata"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                        ?: registeredDrep["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                    val drepName = anchorUrl?.let { fetchDRepName(it) }

                    buildJsonObject {
                        put("isRegistered", true)
                        put("id", drepId)
                        put("name", drepName?.let { JsonPrimitive(it) } ?: JsonNull)
                        put("anchorUrl", anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                    }
                }

                CardanoCache.drepInfo.put(cacheKey, response)
                call.respond(response)
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
        // Served from CardanoCache.stakeDeleg (60-s TTL) — reconnects/page refreshes
        // within one minute are instant. Intentionally returns name:null; the client
        // background-fetches the name via /dreps/{id} (served from drepInfo cache).
        get("/{stakeAddress}/delegation") {
            val stakeAddress = call.parameters["stakeAddress"]
                ?: return@get call.respond(mapOf("error" to "stakeAddress required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            val cacheKey = "${network.name}:$stakeAddress"

            // Cache hit — respond instantly, no Ogmios round-trip
            CardanoCache.stakeDeleg.getIfPresent(cacheKey)?.let { cached ->
                call.respond(cached)
                return@get
            }

            // Cache miss — single Ogmios query, no external HTTP
            val queries = OgmiosStateQueries(network)
            try {
                val delegationRaw = queries.getStakeDelegation(stakeAddress)

                val accountInfo = when {
                    delegationRaw is JsonArray -> delegationRaw.firstOrNull()?.jsonObject
                    delegationRaw is JsonObject -> delegationRaw[stakeAddress]?.jsonObject
                        ?: delegationRaw.values.firstOrNull()?.jsonObject
                    else -> null
                }

                val drepCredential = accountInfo?.let { info ->
                    val delegate = info["delegateRepresentative"]?.jsonObject
                    if (delegate?.get("type")?.jsonPrimitive?.contentOrNull == "registered") {
                        delegate["id"]?.jsonPrimitive?.contentOrNull
                    } else null
                }

                val response = if (drepCredential == null) {
                    buildJsonObject { put("delegatedDrep", JsonNull) }
                } else {
                    buildJsonObject {
                        putJsonObject("delegatedDrep") {
                            put("id", drepCredential)
                            put("name", JsonNull)
                        }
                    }
                }

                CardanoCache.stakeDeleg.put(cacheKey, response)
                call.respond(response)
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
        withTimeout(5_000L) {
            val response = httpClient.get(anchorUrl)
            val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            json["body"]?.jsonObject?.get("givenName")?.jsonPrimitive?.contentOrNull
                ?: json["givenName"]?.jsonPrimitive?.contentOrNull
                ?: json["name"]?.jsonPrimitive?.contentOrNull
        }
    } catch (_: Exception) {
        null
    }
}
