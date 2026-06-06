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
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.actionTypeLabel
import vote.tempo.cardano.credentialHexToStakeAddress
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

        // GET /dreps/{drepId}/votes?network=preprod&page=1&limit=20
        // Returns paginated list of governance actions voted on by this DRep.
        get("/{drepId}/votes") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(mapOf("error" to "drepId required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val page = call.request.queryParameters["page"]?.toIntOrNull()?.coerceAtLeast(1) ?: 1
            val limit = call.request.queryParameters["limit"]?.toIntOrNull()?.coerceIn(1, 100) ?: 20

            val credentialHex = runCatching { drepIdToCredentialHex(drepId) }.getOrNull()
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid drepId"))

            try {
                // Use shared govActions cache (same cache as GovernanceRoutes)
                val raw = CardanoCache.govActions.getIfPresent(network.name) ?: run {
                    val r = OgmiosStateQueries(network).getGovernanceProposals()
                    CardanoCache.govActions.put(network.name, r)
                    r
                }

                val array: JsonArray = when (raw) {
                    is JsonArray  -> raw
                    is JsonObject -> raw["governanceProposals"]?.jsonArray
                        ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
                        ?: JsonArray(emptyList())
                    else -> JsonArray(emptyList())
                }

                // Collect all GAs where this DRep has voted
                val drepVotes = mutableListOf<JsonObject>()
                for (item in array) {
                    val obj = runCatching { item.jsonObject }.getOrNull() ?: continue
                    val votes = obj["votes"]?.jsonArray ?: continue
                    val myVote = votes.firstOrNull { entry ->
                        val issuer = runCatching { entry.jsonObject["issuer"]?.jsonObject }.getOrNull()
                        issuer?.get("role")?.jsonPrimitive?.contentOrNull == "delegateRepresentative"
                            && issuer["id"]?.jsonPrimitive?.contentOrNull == credentialHex
                    }?.jsonObject?.get("vote")?.jsonPrimitive?.contentOrNull ?: continue

                    val proposal = obj["proposal"]?.jsonObject ?: continue
                    val txHash = proposal["transaction"]?.jsonObject?.get("id")
                        ?.jsonPrimitive?.contentOrNull ?: continue
                    val index = proposal["index"]?.jsonPrimitive?.int ?: 0
                    val actionType = obj["action"]?.jsonObject?.get("type")
                        ?.jsonPrimitive?.contentOrNull ?: "unknown"
                    val anchorUrl = obj["metadata"]?.jsonObject?.get("url")
                        ?.jsonPrimitive?.contentOrNull
                    val expiresEpoch = obj["until"]?.jsonObject?.get("epoch")
                        ?.jsonPrimitive?.int ?: 0

                    drepVotes.add(buildJsonObject {
                        put("txHash", txHash)
                        put("index", index)
                        put("type", actionTypeLabel(actionType))
                        put("actionType", actionType)
                        put("anchorUrl", anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                        put("vote", myVote)
                        put("expiresEpoch", expiresEpoch)
                    })
                }

                val total = drepVotes.size
                val offset = (page - 1) * limit
                val pageVotes = drepVotes.drop(offset).take(limit)

                call.respond(buildJsonObject {
                    put("votes", JsonArray(pageVotes))
                    put("total", total)
                    put("page", page)
                    put("limit", limit)
                })
            } catch (e: Exception) {
                // Return empty votes when Ogmios is unavailable — prefer graceful degradation
                call.respond(buildJsonObject {
                    put("votes", JsonArray(emptyList()))
                    put("total", 0)
                    put("page", page)
                    put("limit", limit)
                    put("error", e.message ?: "Ogmios unavailable")
                })
            }
        }

        // GET /dreps/{drepId}?network=mainnet
        // Lookup order:
        //   1. drepInfo cache (30-min TTL)
        //   2. drepList cache pre-warmed by BackgroundPoller (no Ogmios connection needed)
        //   3. Direct Ogmios query (fallback only — avoids concurrent WS contention with step2)
        get("/{drepId}") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(mapOf("error" to "drepId required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            val credentialHex = drepIdToCredentialHex(drepId)
            val cacheKey = "${network.name}:$credentialHex"

            // 1. drepInfo cache
            CardanoCache.drepInfo.getIfPresent(cacheKey)?.let { cached ->
                call.respond(cached)
                return@get
            }

            // 2. Search the pre-warmed drepList — zero Ogmios connections, instant response.
            // The BackgroundPoller fills drepList 3 s after startup and refreshes every 5 min.
            // Searching here eliminates WS contention when step1 and step2 fire in parallel.
            val fromList = searchDrepList(network, drepId, credentialHex)
            if (fromList != null) {
                val anchorUrl = fromList["anchorUrl"]?.takeIf { it !is JsonNull }
                    ?.jsonPrimitive?.contentOrNull
                val drepName = anchorUrl?.let { fetchDRepName(it) }

                // votingPower: use 0 if stake is absent (newly registered DRep, no delegators yet)
                val votingPower = fromList["votingPower"]
                    ?.takeIf { it !is JsonNull }?.jsonPrimitive?.longOrNull ?: 0L
                // Fallback: try to get stake key balance when voting power is 0
                val stakeKeyBalance = if (votingPower == 0L) {
                    queryStakeKeyBalance(credentialHex, network)
                } else null

                val response = buildJsonObject {
                    put("isRegistered", fromList["isRegistered"]!!)
                    put("id", drepId)
                    put("name", drepName?.let { JsonPrimitive(it) } ?: JsonNull)
                    put("anchorUrl", fromList["anchorUrl"]!!)
                    put("votingPower", JsonPrimitive(votingPower))
                    put("stakeKeyBalance", stakeKeyBalance?.let { JsonPrimitive(it) } ?: JsonNull)
                }
                CardanoCache.drepInfo.put(cacheKey, response)
                call.respond(response)
                return@get
            }

            // 3. drepList not yet warm — fall back to direct Ogmios query
            val queries = OgmiosStateQueries(network)
            try {
                val raw = queries.getDRepByIdRaw(drepId)

                val drepsArray: JsonArray = when {
                    raw is JsonArray -> raw
                    raw is JsonObject && raw["delegateRepresentatives"] is JsonArray ->
                        raw["delegateRepresentatives"]!!.jsonArray
                    else -> JsonArray(emptyList())
                }

                val registeredDrep = drepsArray
                    .mapNotNull { runCatching { it.jsonObject }.getOrNull() }
                    .firstOrNull { it["type"]?.jsonPrimitive?.contentOrNull == "registered" }

                val response = if (registeredDrep == null) {
                    buildJsonObject {
                        put("isRegistered", false)
                        put("id", drepId)
                        put("name", JsonNull)
                        put("anchorUrl", JsonNull)
                        put("votingPower", JsonNull)
                        put("stakeKeyBalance", JsonNull)
                    }
                } else {
                    val anchorUrl = registeredDrep["metadata"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                        ?: registeredDrep["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                    val drepName = anchorUrl?.let { fetchDRepName(it) }
                    val votingPower = extractStakeLovelace(registeredDrep["stake"]) ?: 0L
                    val stakeKeyBalance = if (votingPower == 0L) {
                        queryStakeKeyBalance(credentialHex, network)
                    } else null
                    buildJsonObject {
                        put("isRegistered", true)
                        put("id", drepId)
                        put("name", drepName?.let { JsonPrimitive(it) } ?: JsonNull)
                        put("anchorUrl", anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                        put("votingPower", JsonPrimitive(votingPower))
                        put("stakeKeyBalance", stakeKeyBalance?.let { JsonPrimitive(it) } ?: JsonNull)
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
 * Search the pre-warmed drepList cache for a specific DRep.
 * Returns a partial JsonObject { isRegistered: true, anchorUrl } on a POSITIVE match only.
 * Returns null when:
 *   - The list is not yet warmed (BackgroundPoller hasn't run yet), OR
 *   - The DRep was not found — caller falls through to a direct Ogmios query so we
 *     never cache a false-negative (e.g. when the list just refreshed and the DRep
 *     was newly registered).
 *
 * Ogmios may return DRep `id` as bech32 (drep1…) or as raw hex credential hash.
 * Both are normalised to hex before comparison so the lookup works regardless of format.
 */
private fun searchDrepList(network: Network, drepId: String, credentialHex: String): JsonObject? {
    val listRaw = CardanoCache.drepList.getIfPresent(network.name) ?: return null

    val drepsArray: JsonArray = when {
        listRaw is JsonArray -> listRaw
        listRaw is JsonObject && listRaw["delegateRepresentatives"] is JsonArray ->
            listRaw["delegateRepresentatives"]!!.jsonArray
        else -> return null
    }

    val match = drepsArray
        .mapNotNull { runCatching { it.jsonObject }.getOrNull() }
        .firstOrNull { entry ->
            if (entry["type"]?.jsonPrimitive?.contentOrNull != "registered") return@firstOrNull false
            val id = entry["id"]?.jsonPrimitive?.contentOrNull ?: return@firstOrNull false
            // Normalise to hex for robust comparison:
            //   • list has bech32, input is bech32  → id == drepId
            //   • list has hex,    input is hex     → id == credentialHex
            //   • list has bech32, input is hex     → decode list entry and compare
            //   • list has hex,    input is bech32  → id == credentialHex (same value)
            id == drepId || id == credentialHex ||
                (id.startsWith("drep") &&
                    runCatching { drepIdToCredentialHex(id) }.getOrNull() == credentialHex)
        }
        ?: return null  // not found — fall through to Ogmios so we never cache false-negatives

    val anchorUrl = match["metadata"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
        ?: match["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull

    return buildJsonObject {
        put("isRegistered", true)
        put("anchorUrl", anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
        put("votingPower", extractStakeLovelace(match["stake"])?.let { JsonPrimitive(it) } ?: JsonNull)
    }
}

/**
 * Extract lovelace from the DRep `stake` field, which may appear in several Ogmios formats:
 *   1. Direct long:            "stake": 689202321000
 *   2. Lovelace object:        "stake": { "lovelace": 689202321000 }
 *   3. ADA-wrapped object:     "stake": { "ada": { "lovelace": 689202321000 } }
 * Returns null if the field is absent or cannot be parsed.
 */
private fun extractStakeLovelace(stakeElement: JsonElement?): Long? = when {
    stakeElement == null || stakeElement is JsonNull -> null
    stakeElement is JsonPrimitive -> stakeElement.longOrNull
    stakeElement is JsonObject ->
        stakeElement["ada"]?.jsonObject?.get("lovelace")?.jsonPrimitive?.longOrNull
            ?: stakeElement["lovelace"]?.jsonPrimitive?.longOrNull
    else -> null
}

/**
 * Best-effort: derive a stake address from the DRep's credential hex and query its
 * current balance via Ogmios rewardAccountSummaries.
 * Works when the DRep registered with their own stake key (typical CIP-95 wallets).
 * Returns null if address derivation or Ogmios query fails.
 */
private suspend fun queryStakeKeyBalance(credentialHex: String, network: Network): Long? = runCatching {
    val stakeAddress = credentialHexToStakeAddress(credentialHex, network) ?: return@runCatching null
    val queries = OgmiosStateQueries(network)
    val result = queries.getStakeDelegation(stakeAddress)

    val accountInfo = when {
        result is JsonArray  -> result.firstOrNull()?.jsonObject
        result is JsonObject -> result[stakeAddress]?.jsonObject
            ?: result.values.firstOrNull()?.jsonObject
        else -> null
    } ?: return@runCatching null

    // rewardAccountSummaries returns { deposit, rewards, delegate, delegateRepresentative }
    // The ADA balance of the stake credential is NOT directly in this query.
    // Instead, look for any balance fields:
    extractStakeLovelace(accountInfo["deposit"])
        ?: extractStakeLovelace(accountInfo["rewards"])
        ?: extractStakeLovelace(accountInfo["stake"])
}.getOrNull()

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
