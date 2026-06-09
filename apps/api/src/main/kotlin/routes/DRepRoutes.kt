package vote.tempo.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.actionTypeLabel
import vote.tempo.cardano.credentialHexToStakeAddress
import vote.tempo.cardano.credentialHexToDrepIdCip105
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.cardano.fetchDRepVotingPowerBatch
import vote.tempo.cardano.fetchDelegatorCount
import vote.tempo.cardano.fetchDRepKoiosStats
import vote.tempo.cardano.networkFromString
import vote.tempo.cardano.parseDRepStakeContext
import vote.tempo.db.DrepVotes
import vote.tempo.db.GovernanceActionSnapshots

private val httpClient = HttpClient(CIO)

private data class DRepCandidate(
    val id: String,
    val credHex: String,
    val anchorUrl: String?,
    val activeVotingPower: Long,
)

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

            // Key: "proposalTxHash#proposalIndex" → vote entry (dedup keeps most recent)
            val merged = mutableMapOf<String, JsonObject>()

            // ── Source 1: Chain-sync indexed votes from DB ────────────────────
            try {
                transaction {
                    DrepVotes.selectAll()
                        .where {
                            (DrepVotes.network eq network.name) and
                            (DrepVotes.drepCredentialHex eq credentialHex)
                        }
                        .orderBy(DrepVotes.slot, SortOrder.DESC)
                        .forEach { row ->
                            val key = "${row[DrepVotes.proposalTxHash]}#${row[DrepVotes.proposalIndex]}"
                            merged[key] = buildJsonObject {
                                put("txHash",      row[DrepVotes.proposalTxHash])
                                put("index",       row[DrepVotes.proposalIndex])
                                put("type",        actionTypeLabel(row[DrepVotes.actionType] ?: "unknown"))
                                put("actionType",  row[DrepVotes.actionType] ?: "unknown")
                                put("anchorUrl",   row[DrepVotes.anchorUrl]?.let { JsonPrimitive(it) } ?: JsonNull)
                                put("vote",        row[DrepVotes.vote])
                                put("expiresEpoch", row[DrepVotes.expiresEpoch]?.let { JsonPrimitive(it) } ?: JsonNull)
                            }
                        }
                }
            } catch (_: Exception) {
                // DB unavailable — continue with ledger-state source only
            }

            // ── Source 2: Active proposals from Ogmios ledger state ───────────
            // Enriches DB entries with action metadata; also covers proposals not
            // yet indexed (e.g. submitted in the current slot window).
            try {
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
                for (item in array) {
                    val obj = runCatching { item.jsonObject }.getOrNull() ?: continue
                    val votes = obj["votes"]?.jsonArray ?: continue
                    val myVote = votes.firstOrNull { entry ->
                        val issuer = runCatching { entry.jsonObject["issuer"]?.jsonObject }.getOrNull()
                        if (issuer?.get("role")?.jsonPrimitive?.contentOrNull != "delegateRepresentative") return@firstOrNull false
                        val issuerId = issuer["id"]?.jsonPrimitive?.contentOrNull ?: return@firstOrNull false
                        val normalizedId = if (issuerId.startsWith("drep")) {
                            runCatching { drepIdToCredentialHex(issuerId) }.getOrElse { issuerId }
                        } else issuerId
                        normalizedId == credentialHex
                    }?.jsonObject?.get("vote")?.jsonPrimitive?.contentOrNull ?: continue

                    val proposal = obj["proposal"]?.jsonObject ?: continue
                    val proposalTxHash = proposal["transaction"]?.jsonObject?.get("id")
                        ?.jsonPrimitive?.contentOrNull ?: continue
                    val index = proposal["index"]?.jsonPrimitive?.int ?: 0
                    val actionType = obj["action"]?.jsonObject?.get("type")
                        ?.jsonPrimitive?.contentOrNull ?: "unknown"
                    val anchorUrl = obj["metadata"]?.jsonObject?.get("url")
                        ?.jsonPrimitive?.contentOrNull
                    val expiresEpoch = obj["until"]?.jsonObject?.get("epoch")?.jsonPrimitive?.int

                    val key = "$proposalTxHash#$index"
                    merged[key] = buildJsonObject {
                        put("txHash",      proposalTxHash)
                        put("index",       index)
                        put("type",        actionTypeLabel(actionType))
                        put("actionType",  actionType)
                        put("anchorUrl",   anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                        put("vote",        myVote)
                        put("expiresEpoch", expiresEpoch?.let { JsonPrimitive(it) } ?: JsonNull)
                    }
                }
            } catch (_: Exception) { }

            val allVotes = merged.values
                .sortedByDescending { it["expiresEpoch"]?.jsonPrimitive?.intOrNull ?: 0 }
            val total = allVotes.size
            val offset = (page - 1) * limit
            val pageVotes = allVotes.drop(offset).take(limit)

            call.respond(buildJsonObject {
                put("votes", JsonArray(pageVotes))
                put("total", total)
                put("page", page)
                put("limit", limit)
            })
        }

        // GET /dreps/{drepId}/stats?network=mainnet
        // Returns live DRep activity stats: voting power, delegators, influence, voted %.
        // Cold fetch: 2-3 Koios calls (~1-2s). Cached 15 min per DRep.
        get("/{drepId}/stats") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            val credentialHex = runCatching { drepIdToCredentialHex(drepId) }.getOrNull()
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid drepId"))
            val cacheKey = "${network.name}:$credentialHex"

            CardanoCache.drepStats.getIfPresent(cacheKey)?.let { cached ->
                call.respond(cached)
                return@get
            }

            // ── Active voting power + influence from Ogmios cache ─────────────
            val stakeCtx = CardanoCache.drepList.getIfPresent(network.name)
                ?.let { runCatching { parseDRepStakeContext(it) }.getOrNull() }
            val activeVotingPower = stakeCtx?.stakeMap?.get(credentialHex) ?: 0L
            val influencePower = if ((stakeCtx?.totalActiveDRepStake ?: 0L) > 0L)
                activeVotingPower.toDouble() / stakeCtx!!.totalActiveDRepStake.toDouble() * 100.0
            else 0.0

            // ── Total GA count from DB snapshot + live Ogmios ─────────────────
            val dbGaCount = runCatching {
                transaction {
                    GovernanceActionSnapshots.selectAll()
                        .where { GovernanceActionSnapshots.network eq network.name.lowercase() }
                        .count()
                        .toInt()
                }
            }.getOrDefault(0)
            // ── Live stats from Koios ──────────────────────────────────────────
            // Koios only accepts CIP-105 bech32 (drep1y...) — convert from any input format.
            val cip105Id = credentialHexToDrepIdCip105(credentialHex) ?: drepId
            val koios = fetchDRepKoiosStats(cip105Id, network)
            val liveVotingPower = koios?.liveVotingPower ?: activeVotingPower
            val delegatorCount  = koios?.delegatorCount  ?: 0
            val votedCount      = koios?.votedCount      ?: 0
            // Use Koios chain-wide total as denominator — our DB snapshot may be partial.
            // Fall back to DB count only when Koios call failed entirely.
            val liveGaCount  = CardanoCache.parsedGovActions.getIfPresent(network.name)?.size ?: 0
            val totalGaCount = koios?.totalGaCount ?: dbGaCount.coerceAtLeast(liveGaCount)

            val votedPercent    = if (totalGaCount > 0) votedCount.toDouble() / totalGaCount * 100.0 else 0.0
            val notVotedPercent = (100.0 - votedPercent).coerceAtLeast(0.0)

            val result = buildJsonObject {
                put("activeVotingPower", activeVotingPower)
                put("liveVotingPower",   liveVotingPower)
                put("delegatorCount",    delegatorCount)
                put("influencePower",    influencePower)
                put("votedCount",        votedCount)
                put("totalGaCount",      totalGaCount)
                put("votedPercent",      votedPercent)
                put("notVotedPercent",   notVotedPercent)
            }

            if (koios != null) CardanoCache.drepStats.put(cacheKey, result)
            call.respond(result)
        }

        // GET /dreps/leaderboard?metric=delegators&limit=5&network=mainnet
        // Returns top N DReps sorted by delegator count.
        // Result is cached 15 min — Koios stats per candidate also reuse drepStats cache.
        get("/leaderboard") {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val limit = call.request.queryParameters["limit"]?.toIntOrNull()?.coerceIn(1, 20) ?: 5
            val leaderboardKey = "${network.name}:$limit"

            // ── Leaderboard result cache (15 min) ────────────────────────────────
            CardanoCache.leaderboard.getIfPresent(leaderboardKey)?.let { cached ->
                call.respond(cached)
                return@get
            }

            // Widen candidate pool to reduce chance of missing top-delegator DReps
            val candidateCount = limit * 10

            val listRaw = CardanoCache.drepList.getIfPresent(network.name) ?: run {
                try {
                    val r = OgmiosStateQueries(network).getDelegateRepresentatives()
                    CardanoCache.drepList.put(network.name, r)
                    r
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.ServiceUnavailable, buildJsonObject {
                        put("error", "DRep list unavailable: ${e.message}")
                    })
                    return@get
                }
            }

            val drepsArray: JsonArray = when {
                listRaw is JsonArray -> listRaw
                listRaw is JsonObject && listRaw["delegateRepresentatives"] is JsonArray ->
                    listRaw["delegateRepresentatives"]!!.jsonArray
                else -> JsonArray(emptyList())
            }

            val stakeCtx = runCatching { parseDRepStakeContext(listRaw) }.getOrNull()

            val candidates = drepsArray
                .mapNotNull { entry ->
                    runCatching {
                        val obj = entry.jsonObject
                        if (obj["type"]?.jsonPrimitive?.contentOrNull != "registered") return@mapNotNull null
                        val rawId = obj["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                        val credHex = if (rawId.startsWith("drep"))
                            drepIdToCredentialHex(rawId)
                        else rawId
                        val anchorUrl = obj["metadata"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                            ?: obj["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull
                        val stake = extractStakeLovelace(obj["stake"]) ?: 0L
                        DRepCandidate(rawId, credHex, anchorUrl, stake)
                    }.getOrNull()
                }
                .sortedByDescending { it.activeVotingPower }
                .take(candidateCount)

            // ── Step 1: batch-fetch liveVotingPower for all candidates (1-2 Koios calls) ──
            // Koios /drep_info does not include delegator_count, so we key by credential hex
            // (`hex` field) which is stable — drep_id in the response uses CIP-129 bech32,
            // different from the CIP-105 IDs we generate.
            val allCip105Ids = candidates.map { credentialHexToDrepIdCip105(it.credHex) ?: it.id }
            val vpByCredHex  = fetchDRepVotingPowerBatch(allCip105Ids, network)

            // ── Step 2: sort candidates by liveVotingPower, narrow to limit×2 pool ──
            // delegator_count is correlated with voting power; narrowing here keeps
            // drep_delegators calls to at most limit×2 (≤40) instead of candidateCount (≤200).
            val narrowed = candidates.mapIndexed { idx, c ->
                val cip105Id    = allCip105Ids[idx]
                val activeVp    = stakeCtx?.stakeMap?.get(c.credHex) ?: c.activeVotingPower
                val liveVp      = vpByCredHex[c.credHex] ?: activeVp
                Triple(c, cip105Id, Pair(activeVp, liveVp))
            }.sortedByDescending { it.third.second }.take(limit * 2)

            // ── Step 3: fetch delegatorCount for narrowed pool (max limit×2 individual calls) ──
            val results = coroutineScope {
                narrowed.map { (candidate, cip105Id, vps) ->
                    async {
                        val (activeVp, liveVp) = vps
                        val influence = if ((stakeCtx?.totalActiveDRepStake ?: 0L) > 0L)
                            activeVp.toDouble() / stakeCtx!!.totalActiveDRepStake.toDouble() * 100.0
                        else 0.0

                        val cachedStats = CardanoCache.drepStats.getIfPresent("${network.name}:${candidate.credHex}")
                        val delegatorCount = cachedStats?.get("delegatorCount")?.jsonPrimitive?.intOrNull
                            ?: fetchDelegatorCount(cip105Id, network)

                        buildJsonObject {
                            put("id", cip105Id)
                            put("credHex", candidate.credHex)
                            put("anchorUrl", candidate.anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                            put("activeVotingPower", activeVp)
                            put("liveVotingPower", liveVp)
                            put("delegatorCount", delegatorCount)
                            put("influencePower", influence)
                        }
                    }
                }.awaitAll()
            }

            val sorted = results
                .sortedByDescending { it["delegatorCount"]?.jsonPrimitive?.intOrNull ?: 0 }
                .take(limit)

            val resultArray = JsonArray(sorted)
            CardanoCache.leaderboard.put(leaderboardKey, resultArray)
            call.respond(resultArray)
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
            val fromList = searchDrepList(network, drepId, credentialHex)
            if (fromList != null) {
                val response = buildDRepResponse(drepId, credentialHex, network, fromList)
                if (nameResolved(response, fromList)) CardanoCache.drepInfo.put(cacheKey, response)
                call.respond(response)
                return@get
            }

            // 3. drepList not yet warm — fetch full DRep list from Ogmios, warm the cache,
            //    then search. Avoids the Ogmios filtered-query format ambiguity (hex vs object).
            try {
                val allDreps = OgmiosStateQueries(network).getDelegateRepresentatives()
                CardanoCache.drepList.put(network.name, allDreps)
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, buildJsonObject {
                    put("error", e.message ?: "Ogmios query failed")
                })
                return@get
            }

            val fromFresh = searchDrepList(network, drepId, credentialHex)
            val response = buildDRepResponse(drepId, credentialHex, network, fromFresh)
            if (nameResolved(response, fromFresh)) CardanoCache.drepInfo.put(cacheKey, response)
            call.respond(response)
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
 * Returns true when it's safe to cache a /dreps/{id} response.
 * We skip caching when the DRep has an anchor URL but name is still null — that
 * means the IPFS/metadata fetch failed transiently. The next request will retry.
 */
private fun nameResolved(response: JsonObject, listEntry: JsonObject?): Boolean {
    if (listEntry == null) return true  // "not found" is a stable negative result
    val hasAnchor = listEntry["anchorUrl"]?.takeIf { it !is JsonNull }
        ?.jsonPrimitive?.contentOrNull != null
    val hasName = response["name"]?.takeIf { it !is JsonNull }
        ?.jsonPrimitive?.contentOrNull != null
    return !hasAnchor || hasName
}

/**
 * Build the full DRep profile JSON response from a searchDrepList result.
 * Pass null for [listEntry] when the DRep was not found → returns isRegistered=false.
 */
private suspend fun buildDRepResponse(
    drepId: String,
    credentialHex: String,
    network: Network,
    listEntry: JsonObject?,
): JsonObject {
    // Always return canonical CIP-105 ID regardless of which format the caller used.
    val canonicalId = credentialHexToDrepIdCip105(credentialHex) ?: drepId

    if (listEntry == null) {
        return buildJsonObject {
            put("isRegistered", false)
            put("active", false)
            put("mandateExpiresEpoch", JsonNull)
            put("id", canonicalId)
            put("name", JsonNull)
            put("anchorUrl", JsonNull)
            put("votingPower", JsonNull)
            put("stakeKeyBalance", JsonNull)
        }
    }

    val anchorUrl = listEntry["anchorUrl"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.contentOrNull
    val drepName = anchorUrl?.let { fetchDRepName(it) }
    val votingPower = listEntry["votingPower"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.longOrNull ?: 0L
    // stakeKeyBalance requires Kupo UTxO query — rewardAccountSummaries only returns deposit/rewards,
    // not actual wallet balance. Return null until Kupo integration is added.
    val stakeKeyBalance: Long? = null
    val mandateEpoch = listEntry["mandateEpoch"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.intOrNull
    val currentEpoch = runCatching { OgmiosStateQueries(network).getCurrentEpoch() }.getOrNull()
    val isActive = mandateEpoch == null || currentEpoch == null || mandateEpoch >= currentEpoch

    return buildJsonObject {
        put("isRegistered", true)
        put("active", isActive)
        put("mandateExpiresEpoch", mandateEpoch?.let { JsonPrimitive(it) } ?: JsonNull)
        put("id", canonicalId)
        put("name", drepName?.let { JsonPrimitive(it) } ?: JsonNull)
        put("anchorUrl", listEntry["anchorUrl"]!!)
        put("votingPower", JsonPrimitive(votingPower))
        put("stakeKeyBalance", stakeKeyBalance?.let { JsonPrimitive(it) } ?: JsonNull)
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

    val mandateEpoch = match["mandate"]?.jsonObject?.get("epoch")?.jsonPrimitive?.intOrNull

    return buildJsonObject {
        put("isRegistered", true)
        put("anchorUrl", anchorUrl?.let { JsonPrimitive(it) } ?: JsonNull)
        put("votingPower", extractStakeLovelace(match["stake"])?.let { JsonPrimitive(it) } ?: JsonNull)
        put("mandateEpoch", mandateEpoch?.let { JsonPrimitive(it) } ?: JsonNull)
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

private val PINATA_GATEWAY = System.getenv("PINATA_GATEWAY") ?: "https://ipfs.io"
private val IPFS_GATEWAYS_BE = listOf("$PINATA_GATEWAY/ipfs/", "https://ipfs.io/ipfs/", "https://dweb.link/ipfs/")

/** Extract CID from any IPFS URL form (ipfs:// or https://<gateway>/ipfs/<cid>) */
private fun extractIpfsCid(url: String): String? {
    if (url.startsWith("ipfs://")) return url.removePrefix("ipfs://").substringBefore("/")
    val match = Regex("^https?://[^/]+/ipfs/([^/?#]+)").find(url)
    return match?.groupValues?.get(1)
}

/** Build candidate URLs for an anchor: try all gateways if it's IPFS, else return as-is.
 *
 * If the anchor is an HTTPS URL (e.g. a private QuickNode or Pinata gateway), try it first —
 * it's the most reliable source. Then fall back to well-known public gateways.
 * If the anchor is an ipfs:// URI, try public gateways only.
 */
private fun buildCandidateUrls(anchorUrl: String): List<String> {
    val cid = extractIpfsCid(anchorUrl) ?: return listOf(anchorUrl)
    val origIfHttps = if (!anchorUrl.startsWith("ipfs://")) listOf(anchorUrl) else emptyList()
    return (origIfHttps + IPFS_GATEWAYS_BE.map { "${it}${cid}" }).distinct()
}

/**
 * Fetch DRep metadata from anchor URL and extract the given name.
 * Supports CIP-119 format: { body: { givenName: "..." } }
 * Tries multiple IPFS gateways with short timeout each.
 */
private suspend fun fetchDRepName(anchorUrl: String): String? {
    val candidates = buildCandidateUrls(anchorUrl)
    for (url in candidates) {
        try {
            val result = withTimeout(5_000L) {
                val response = httpClient.get(url)
                if (!response.status.isSuccess()) return@withTimeout null
                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                json["body"]?.jsonObject?.get("givenName")?.jsonPrimitive?.contentOrNull
                    ?: json["givenName"]?.jsonPrimitive?.contentOrNull
                    ?: json["name"]?.jsonPrimitive?.contentOrNull
            }
            if (result != null) return result
        } catch (_: Exception) {
            continue
        }
    }
    return null
}
