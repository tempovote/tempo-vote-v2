package vote.tempo.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.async
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
import vote.tempo.cardano.networkFromString
import vote.tempo.cardano.parseDRepStakeContext
import vote.tempo.db.ChainIndexDao
import vote.tempo.db.DrepVotes
import vote.tempo.db.GovernanceActionSnapshots

internal val httpClient = HttpClient(CIO)

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
            // ── Live stats from local chain index ─────────────────────────────
            // Prefer VoteIndexer DB; fall back to Ogmios drepDelegatorCounts cache
            // (populated by BackgroundPoller from delegateRepresentatives response).
            val delegatorCountDb = ChainIndexDao.getDelegatorCount(credentialHex, network.name.lowercase())
            val delegatorCount = if (delegatorCountDb > 0) delegatorCountDb
                else CardanoCache.drepDelegatorCounts.getIfPresent(network.name)?.get(credentialHex) ?: 0
            // Prefer VoteIndexer drep_votes (accurate if synced); fall back to snapshot_json scan
            // when VoteIndexer hasn't indexed this network yet (e.g. mainnet VoteIndexer not running).
            val votedCountVi   = ChainIndexDao.getVotedCount(credentialHex, network.name.lowercase())
            val votedCount = if (votedCountVi > 0) votedCountVi
                else ChainIndexDao.getVotedCountFromSnapshots(credentialHex, network.name.lowercase())

            val liveGaCount     = CardanoCache.parsedGovActions.getIfPresent(network.name)?.size ?: 0
            val totalGaCount    = dbGaCount.coerceAtLeast(liveGaCount)

            val votedPercent    = if (totalGaCount > 0) votedCount.toDouble() / totalGaCount * 100.0 else 0.0
            val notVotedPercent = (100.0 - votedPercent).coerceAtLeast(0.0)

            val result = buildJsonObject {
                put("activeVotingPower", activeVotingPower)
                put("liveVotingPower",   activeVotingPower)  // live = active from Ogmios
                put("delegatorCount",    delegatorCount)
                put("influencePower",    influencePower)
                put("votedCount",        votedCount)
                put("totalGaCount",      totalGaCount)
                put("votedPercent",      votedPercent)
                put("notVotedPercent",   notVotedPercent)
            }

            CardanoCache.drepStats.put(cacheKey, result)
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

            // ── Delegator counts: pre-warmed by BackgroundPoller, read from cache ──
            // BackgroundPoller fetches delegatorCount sequentially for the top 200 DReps
            // every 5 min, avoiding Koios burst limits. The leaderboard just reads from
            // cache — no Koios calls at request time.
            val delegCounts = CardanoCache.drepDelegatorCounts.getIfPresent(network.name) ?: emptyMap()

            // CIP-105 IDs for response field; voting power comes from Ogmios stakeMap directly.
            val allCip105Ids = candidates.map { credentialHexToDrepIdCip105(it.credHex) ?: it.id }

            val results = candidates.mapIndexed { idx, candidate ->
                val cip105Id    = allCip105Ids[idx]
                val activeVp    = stakeCtx?.stakeMap?.get(candidate.credHex) ?: candidate.activeVotingPower
                val liveVp      = activeVp  // Ogmios stake IS live voting power in Conway era
                val influence   = if ((stakeCtx?.totalActiveDRepStake ?: 0L) > 0L)
                    activeVp.toDouble() / stakeCtx!!.totalActiveDRepStake.toDouble() * 100.0
                else 0.0
                // Prefer BackgroundPoller cache; fall back to drepStats cache (from detail page visits)
                val delegatorCount = delegCounts[candidate.credHex]
                    ?: CardanoCache.drepStats.getIfPresent("${network.name}:${candidate.credHex}")
                        ?.get("delegatorCount")?.jsonPrimitive?.intOrNull
                    ?: 0

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

            val sorted = results
                .sortedByDescending { it["delegatorCount"]?.jsonPrimitive?.intOrNull ?: 0 }
                .take(limit)

            // Fetch name + imageUrl server-side for the final top-N DReps.
            // Done after sort+take so we only make `limit` metadata calls (not candidateCount).
            // Checks drepInfo cache first (populated by profile page visits); falls back to
            // fetchDRepMeta so CORS-restricted hosts (e.g. everstake.one) still work.
            val withMeta = coroutineScope {
                sorted.map { entry ->
                    async {
                        val credHex = entry["credHex"]?.jsonPrimitive?.contentOrNull
                        val anchor  = entry["anchorUrl"]?.jsonPrimitive?.contentOrNull
                        val cached  = credHex?.let { CardanoCache.drepInfo.getIfPresent("${network.name}:$it") }
                        val cachedName     = cached?.get("name")?.jsonPrimitive?.contentOrNull
                        val cachedImageUrl = cached?.get("imageUrl")?.jsonPrimitive?.contentOrNull
                        val meta = if ((cachedName == null || cachedImageUrl == null) && anchor != null)
                            fetchDRepMeta(anchor) else null
                        val name     = cachedName     ?: meta?.name
                        val imageUrl = cachedImageUrl ?: meta?.imageUrl
                        // Populate drepInfo cache so vote history can resolve this DRep's name
                        if (credHex != null && (name != null || imageUrl != null) && cached == null) {
                            CardanoCache.drepInfo.put("${network.name}:$credHex", buildJsonObject {
                                put("name",     name?.let { JsonPrimitive(it) } ?: JsonNull)
                                put("imageUrl", imageUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                            })
                        }
                        buildJsonObject {
                            entry.forEach { (k, v) -> put(k, v) }
                            put("name",     name?.let { JsonPrimitive(it) } ?: JsonNull)
                            put("imageUrl", imageUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                        }
                    }
                }.map { it.await() }
            }

            val resultArray = JsonArray(withMeta)
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

            // 1. drepInfo cache — only use full profile entries (those with isRegistered).
            //    Partial entries written by the leaderboard (name+imageUrl only) are skipped.
            CardanoCache.drepInfo.getIfPresent(cacheKey)
                ?.takeIf { it.containsKey("isRegistered") }
                ?.let { cached ->
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
    val meta = anchorUrl?.let { fetchDRepMeta(it) }
    val votingPower = listEntry["votingPower"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.longOrNull ?: 0L
    val stakeKeyBalance: Long? = null
    val mandateEpoch = listEntry["mandateEpoch"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.intOrNull
    val currentEpoch = runCatching { OgmiosStateQueries(network).getCurrentEpoch() }.getOrNull()
    val isActive = mandateEpoch == null || currentEpoch == null || mandateEpoch >= currentEpoch

    return buildJsonObject {
        put("isRegistered", true)
        put("active", isActive)
        put("mandateExpiresEpoch", mandateEpoch?.let { JsonPrimitive(it) } ?: JsonNull)
        put("id", canonicalId)
        put("name", meta?.name?.let { JsonPrimitive(it) } ?: JsonNull)
        put("imageUrl", meta?.imageUrl?.let { JsonPrimitive(it) } ?: JsonNull)
        put("motivations",    meta?.motivations?.let    { JsonPrimitive(it) } ?: JsonNull)
        put("objectives",     meta?.objectives?.let     { JsonPrimitive(it) } ?: JsonNull)
        put("qualifications", meta?.qualifications?.let { JsonPrimitive(it) } ?: JsonNull)
        put("references",     meta?.references ?: JsonNull)
        // true = API fetched the anchor document (even if all fields were empty); skip browser fallback
        put("metaFetched", JsonPrimitive(meta != null))
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

internal val PINATA_GATEWAY = System.getenv("PINATA_GATEWAY") ?: "https://ipfs.io"
internal val IPFS_GATEWAYS_BE = listOf("$PINATA_GATEWAY/ipfs/", "https://ipfs.io/ipfs/", "https://dweb.link/ipfs/")

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
internal fun buildCandidateUrls(anchorUrl: String): List<String> {
    val cid = extractIpfsCid(anchorUrl) ?: return listOf(anchorUrl)
    val origIfHttps = if (!anchorUrl.startsWith("ipfs://")) listOf(anchorUrl) else emptyList()
    return (origIfHttps + IPFS_GATEWAYS_BE.map { "${it}${cid}" }).distinct()
}

internal data class DRepMeta(
    val name: String?,
    val imageUrl: String?,
    val motivations: String? = null,
    val objectives: String? = null,
    val qualifications: String? = null,
    val references: JsonArray? = null,
)

/** Extract plain string or JSON-LD {"@value": "..."} wrapper → nullable String. */
internal fun extractMetaStr(el: JsonElement?): String? {
    if (el == null || el is JsonNull) return null
    if (el is JsonPrimitive) return el.contentOrNull?.takeIf { it.isNotBlank() }
    if (el is JsonObject) return el["@value"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
    return null
}

/**
 * Fetch DRep metadata from anchor URL and extract name, image URL, and CIP-119 body fields.
 * Runs server-side so CORS restrictions on the metadata host don't apply.
 * Supports CIP-119: { body: { givenName, image, motivations, objectives, qualifications, references } }
 */
internal suspend fun fetchDRepMeta(anchorUrl: String): DRepMeta? {
    val candidates = buildCandidateUrls(anchorUrl)
    for (url in candidates) {
        try {
            val result = withTimeout(5_000L) {
                val response = httpClient.get(url)
                if (!response.status.isSuccess()) return@withTimeout null
                val json = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                val body = json["body"]?.jsonObject ?: json

                val name = extractMetaStr(body["givenName"])
                    ?: extractMetaStr(json["givenName"])
                    ?: extractMetaStr(json["name"])

                val imageNode = body["image"]
                val imageUrl = when {
                    imageNode == null || imageNode is JsonNull -> null
                    imageNode is JsonPrimitive -> imageNode.contentOrNull
                    imageNode is JsonObject ->
                        imageNode["contentUrl"]?.jsonPrimitive?.contentOrNull
                            ?: imageNode["url"]?.jsonPrimitive?.contentOrNull
                            ?: imageNode["@id"]?.jsonPrimitive?.contentOrNull
                    else -> null
                }

                val motivations    = extractMetaStr(body["motivations"])
                val objectives     = extractMetaStr(body["objectives"])
                val qualifications = extractMetaStr(body["qualifications"])

                val references = body["references"]?.let { if (it is JsonNull) null else it as? JsonArray }
                    ?.takeIf { it.isNotEmpty() }
                    ?.let { arr ->
                        JsonArray(arr.mapNotNull { el ->
                            val obj = el as? JsonObject ?: return@mapNotNull null
                            val label = extractMetaStr(obj["label"]) ?: return@mapNotNull null
                            val uri   = extractMetaStr(obj["uri"])   ?: return@mapNotNull null
                            buildJsonObject {
                                obj["@type"]?.let { put("@type", it) }
                                put("label", JsonPrimitive(label))
                                put("uri",   JsonPrimitive(uri))
                            }
                        })
                    }
                    ?.takeIf { it.isNotEmpty() }

                if (name == null && imageUrl == null && motivations == null
                    && objectives == null && qualifications == null) null
                else DRepMeta(name, imageUrl, motivations, objectives, qualifications, references)
            }
            if (result != null) return result
        } catch (_: Exception) {
            continue
        }
    }
    return null
}
