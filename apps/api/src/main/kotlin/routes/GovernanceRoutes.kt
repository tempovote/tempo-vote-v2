package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.DRepStakeContext
import vote.tempo.cardano.GovernanceActionDto
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.cardano.CCContext
import vote.tempo.cardano.GovernanceThresholds
import vote.tempo.cardano.networkFromString
import vote.tempo.cardano.parseCCContext
import vote.tempo.cardano.parseDRepStakeContext
import vote.tempo.cardano.parseGovernanceThresholds
import vote.tempo.cardano.VoteEntry
import vote.tempo.cardano.extractSPOPoolIds
import vote.tempo.cardano.parseProposals
import vote.tempo.cardano.fetchEnactedProposalKeys
import vote.tempo.db.ChainIndexDao
import vote.tempo.db.GovernanceActionDao

/**
 * GET /governance/chain-info?network=preprod|mainnet
 * Returns current protocol parameters (for Existing/Proposed UI) and the
 * constitution guardrails script hash.  All numeric values use their natural
 * types (lovelace as Long, rates as Double, counts as Int).
 */
fun Route.chainInfoRoutes() {
    get("/governance/chain-info") {
        val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
        val ogmios = OgmiosStateQueries(network)

        runCatching {
            val raw = ogmios.getProtocolParameters()
            val guardrailsHashBytes = ogmios.getConstitutionGuardrailsHash()
            val guardrailsHash = guardrailsHashBytes?.joinToString("") { "%02x".format(it) }

            // Helpers to parse the Ogmios JSON structure
            // lovelace fields: {lovelace: N} or plain N
            fun lovelace(key: String): Long? = raw[key]?.let { el ->
                when {
                    el is JsonPrimitive -> el.longOrNull
                    el is JsonObject    -> el["lovelace"]?.jsonPrimitive?.longOrNull
                    else               -> null
                }
            }
            // bytes fields: {bytes: N} or plain N
            fun bytes(key: String): Long? = raw[key]?.let { el ->
                when {
                    el is JsonPrimitive -> el.longOrNull
                    el is JsonObject    -> el["bytes"]?.jsonPrimitive?.longOrNull
                    else               -> null
                }
            }
            fun int(key: String): Int?    = raw[key]?.jsonPrimitive?.intOrNull
            fun long(key: String): Long?  = raw[key]?.jsonPrimitive?.longOrNull
            // rational fields: plain Double, "3/10" string, or {"numerator":3,"denominator":10}
            fun rational(key: String): Double? = raw[key]?.let { el ->
                when {
                    el is JsonPrimitive -> el.doubleOrNull
                        ?: el.contentOrNull?.let { s ->
                            val p = s.split("/")
                            if (p.size == 2) p[0].trim().toDoubleOrNull()?.div(p[1].trim().toDoubleOrNull() ?: return@let null) else null
                        }
                    el is JsonObject -> {
                        val n = el["numerator"]?.jsonPrimitive?.doubleOrNull
                        val d = el["denominator"]?.jsonPrimitive?.doubleOrNull
                        if (n != null && d != null && d != 0.0) n / d else null
                    }
                    else -> null
                }
            }

            val params = buildJsonObject {
                // Network group
                bytes("maxTransactionSize")?.let   { put("maxTxSize", it) }
                bytes("maxBlockBodySize")?.let      { put("maxBlockSize", it) }
                bytes("maxBlockHeaderSize")?.let    { put("maxBlockHeaderSize", it) }
                bytes("maxValueSize")?.let          { put("maxValSize", it) }
                int("maxCollateralInputs")?.let     { put("maxCollateralInputs", it) }
                // Economic group
                int("minFeeCoefficient")?.let       { put("minFeeA", it) }
                lovelace("minFeeConstant")?.let     { put("minFeeB", it) }
                lovelace("stakeKeyDeposit")?.let    { put("keyDeposit", it) }
                lovelace("stakePoolDeposit")?.let   { put("poolDeposit", it) }
                rational("monetaryExpansion")?.let  { put("expansionRate", it) }
                rational("treasuryExpansion")?.let  { put("treasuryGrowthRate", it) }
                lovelace("minStakePoolCost")?.let   { put("minPoolCost", it) }
                long("minUtxoDepositCoefficient")?.let { put("adaPerUtxoByte", it) }
                int("collateralPercentage")?.let    { put("collateralPercent", it) }
                // Technical group
                int("desiredNumberOfStakePools")?.let  { put("nOpt", it) }
                int("stakePoolRetirementEpochBound")?.let { put("maxEpoch", it) }
                rational("stakePoolPledgeInfluence")?.let { put("poolPledgeInfluence", it) }
            }

            buildJsonObject {
                guardrailsHash?.let { put("guardrailsHash", it) }
                put("protocolParams", params)
            }
        }.fold(
            onSuccess = { call.respond(it) },
            onFailure = { e ->
                call.respond(HttpStatusCode.InternalServerError,
                    mapOf("error" to (e.message ?: "Failed to fetch chain info")))
            }
        )
    }
}

fun Route.governanceRoutes() {

    /**
     * POST /admin/backfill-enacted?network=mainnet|preprod
     *
     * One-time operation: fetches all governance proposals from Blockfrost, identifies those
     * with enacted_epoch set, and marks them in idx_governance_proposals.final_status = "enacted".
     * This makes historically enacted proposals appear in the "Enacted" filter tab rather than
     * being lumped in with expired proposals.
     *
     * Safe to call multiple times (idempotent UPDATE). Requires BLOCKFROST_{NETWORK}_PROJECT_ID.
     * Returns { "updated": N, "enacted": N } where updated = rows changed in DB.
     */
    post("/admin/backfill-enacted") {
        val network = networkFromString(call.request.queryParameters["network"] ?: "mainnet")
        val enacted = fetchEnactedProposalKeys(network)
        if (enacted.isEmpty()) {
            call.respond(buildJsonObject {
                put("error", "No enacted proposals found or Blockfrost not configured")
                put("network", network.name)
            })
            return@post
        }
        val updated = withContext(Dispatchers.IO) {
            GovernanceActionDao.markFinalStatus(network.name.lowercase(), enacted, "enacted")
        }
        // Invalidate caches so next request serves fresh data
        CardanoCache.parsedGovActions.invalidate(network.name)
        call.respond(buildJsonObject {
            put("network", network.name)
            put("enacted", enacted.size)
            put("updated", updated)
        })
    }

    route("/governance-actions") {

        /**
         * GET /governance-actions?network=preprod&type=treasuryWithdrawals&status=active
         * Returns mapped GovernanceActionDto list — served from cache (refreshed every 5 min).
         * Both `type` and `status` filters are optional; omitting both returns all proposals.
         */
        get {
            val network      = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val typeFilter   = call.request.queryParameters["type"]
            val statusFilter = call.request.queryParameters["status"]

            val proposals = fetchProposals(network)

            val filtered = proposals
                .let { list -> if (typeFilter   != null) list.filter { it.actionType.equals(typeFilter,   ignoreCase = true) } else list }
                .let { list -> if (statusFilter != null) list.filter { it.status.equals(statusFilter, ignoreCase = true) } else list }

            call.respond(filtered)
        }

        /**
         * GET /governance-actions/{txHash}/{index}/my-vote?drepId=drep1...&network=preprod
         * Returns { "voted": "yes"|"no"|"abstain"|null } for the given DRep.
         */
        get("/{txHash}/{index}/my-vote") {
            val txHash = call.parameters["txHash"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "txHash required"))
            val index = call.parameters["index"]?.toIntOrNull()
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "index must be an integer"))
            val drepId = call.request.queryParameters["drepId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            val credentialHex = runCatching { drepIdToCredentialHex(drepId) }.getOrNull()
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid drepId"))

            // Bypass cache: always query Ogmios fresh so recently submitted votes are visible immediately
            val raw = OgmiosStateQueries(network).getGovernanceProposals()

            val array: JsonArray = when (raw) {
                is JsonArray  -> raw
                is JsonObject -> raw["governanceProposals"]?.jsonArray
                    ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Proposals not found"))
                else -> return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Proposals not found"))
            }

            val proposalItem = array.firstOrNull { item ->
                val prop = item.jsonObject["proposal"]?.jsonObject
                prop?.get("transaction")?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull == txHash
                    && prop["index"]?.jsonPrimitive?.int == index
            } ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Governance action not found"))

            val votes = proposalItem.jsonObject["votes"]?.jsonArray ?: JsonArray(emptyList())
            val myVote = votes.firstOrNull { entry ->
                val issuer = entry.jsonObject["issuer"]?.jsonObject
                issuer?.get("role")?.jsonPrimitive?.contentOrNull == "delegateRepresentative"
                    && issuer["id"]?.jsonPrimitive?.contentOrNull == credentialHex
            }?.jsonObject?.get("vote")?.jsonPrimitive?.contentOrNull

            call.respond(mapOf("voted" to myVote))
        }

        /**
         * GET /governance-actions/{txHash}/{index}?network=preprod
         * Returns a single governance action. 404 if not found.
         * For historical proposals (votes = emptyList from getHistoricalFromIndex), loads
         * individual vote entries from drep_votes so the vote history tab is populated.
         */
        get("/{txHash}/{index}") {
            val txHash = call.parameters["txHash"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "txHash required"))
            val index = call.parameters["index"]?.toIntOrNull()
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "index must be an integer"))
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            val proposal = fetchProposals(network).find { it.txHash == txHash && it.index == index }

            if (proposal == null) {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Governance action not found"))
            } else if (proposal.votes.isEmpty()) {
                val dbVotes = withContext(Dispatchers.IO) {
                    ChainIndexDao.getVoteEntriesForProposal(network.name.lowercase(), txHash, index)
                }
                val enriched = resolveVoterNames(network, dbVotes)
                call.respond(proposal.copy(votes = enriched))
            } else {
                call.respond(proposal)
            }
        }
    }
}

/**
 * Enrich DRep vote entries with names.
 * 1. Fill anchorUrl from the live DRep registry (stakeCtx.anchorMap) for entries that
 *    came from drep_votes DB (VoteIndexer doesn't store the DRep's registration anchor).
 * 2. Fetch name from anchorUrl for any DRep not yet in drepInfo cache.
 * 3. Apply cached names to voterName field.
 * Used by the GA detail endpoint for historical proposals (votes loaded from DB).
 */
private suspend fun resolveVoterNames(network: Network, votes: List<VoteEntry>): List<VoteEntry> {
    val stakeCtx = getOrFetchDRepStakeContext(network)

    // Enrich anchor URLs from current DRep registry
    val withAnchors = votes.map { v ->
        if (v.role == "drep" && v.anchorUrl == null)
            v.copy(anchorUrl = stakeCtx.anchorMap[v.id])
        else v
    }

    // Fetch names server-side for uncached entries (bypasses CORS on IPFS gateways)
    val uncached = withAnchors
        .filter { v -> v.role == "drep" && v.anchorUrl != null &&
            CardanoCache.drepInfo.getIfPresent("${network.name}:${v.id}") == null }
        .distinctBy { it.id }

    if (uncached.isNotEmpty()) {
        runCatching {
            withTimeout(10_000L) {
                coroutineScope {
                    uncached.map { vote ->
                        async {
                            val meta = runCatching { fetchDRepMeta(vote.anchorUrl!!) }.getOrNull()
                            val name     = meta?.name
                            val imageUrl = meta?.imageUrl
                            if (name != null || imageUrl != null) {
                                CardanoCache.drepInfo.put("${network.name}:${vote.id}", buildJsonObject {
                                    put("name",     name?.let { JsonPrimitive(it) } ?: JsonNull)
                                    put("imageUrl", imageUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                                })
                            }
                        }
                    }.forEach { it.await() }
                }
            }
        }
    }

    return withAnchors.map { v ->
        if (v.role == "drep") {
            val nameEl = CardanoCache.drepInfo.getIfPresent("${network.name}:${v.id}")?.get("name")
            v.copy(voterName = if (nameEl is JsonPrimitive) nameEl.contentOrNull else null)
        } else v
    }
}

/**
 * Fetch governance proposals — three tiers merged by key (txHash:index):
 *  1. Live proposals from Ogmios (cached, richest data including vote weights)
 *  2. Snapshot historical from governance_action_snapshots (BackgroundPoller saw these)
 *  3. Index historical from idx_governance_proposals (chain-sync covers all since Conway genesis)
 *
 * Tier 3 fills gaps for proposals that expired/enacted/dropped before the backend was deployed.
 * The index tier has vote counts but no historical stake weights (zeros in votingPower fields).
 */
private suspend fun fetchProposals(network: Network): List<GovernanceActionDto> {
    // Current epoch is needed for index-tier status computation and cache-miss path.
    // getOrFetchCurrentEpoch uses its own cache (30 min TTL) so this is near-free on cache hit.
    val epoch = getOrFetchCurrentEpoch(network)

    // ── Live proposals (from cache or Ogmios) ──────────────────────────────────
    val live = CardanoCache.parsedGovActions.getIfPresent(network.name)
        ?: run {
            val stakeCtx   = getOrFetchDRepStakeContext(network)
            val ccCtx      = getOrFetchCCContext(network)
            val thresholds = getOrFetchGovernanceThresholds(network)

            val raw = CardanoCache.govActions.getIfPresent(network.name)
                ?: try {
                    OgmiosStateQueries(network).getGovernanceProposals()
                        .also { CardanoCache.govActions.put(network.name, it) }
                } catch (e: Exception) {
                    return emptyList()
                }

            // Pool info: read from local DB (populated by Blockfrost pool stake indexer every 8 h).
            // Missing pools return PoolInfo(name=null, votingPower=0L) — no external API call.
            val poolInfoMap = withContext(Dispatchers.IO) {
                ChainIndexDao.getPoolInfoMap(extractSPOPoolIds(raw), network.name.lowercase())
            }
            // Rationale URLs: read from local DB (drep_votes.anchor_url, populated by VoteIndexer).
            val proposalPairs = run {
                val arr = when (raw) {
                    is JsonArray  -> raw
                    is JsonObject -> raw["governanceProposals"]?.jsonArray ?: JsonArray(emptyList())
                    else          -> JsonArray(emptyList())
                }
                arr.mapNotNull { item ->
                    val p      = item.jsonObject["proposal"]?.jsonObject ?: return@mapNotNull null
                    val txHash = p["transaction"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                    val index  = p["index"]?.jsonPrimitive?.intOrNull ?: 0
                    txHash to index
                }
            }
            val rationalesMap = withContext(Dispatchers.IO) {
                ChainIndexDao.buildRationalesMap(proposalPairs, network.name.lowercase())
            }
            parseProposals(raw, stakeCtx, ccCtx, thresholds, epoch, poolInfoMap, rationalesMap)
                .also { CardanoCache.parsedGovActions.put(network.name, it) }
        }

    // ── Tier 2: snapshot historical (expired / enacted / dropped seen by BackgroundPoller) ──
    val liveKeys = live.map { "${it.txHash}:${it.index}" }.toSet()
    val historical = GovernanceActionDao.getHistorical(network.name.lowercase())
        .filter { "${it.txHash}:${it.index}" !in liveKeys }

    // ── Tier 3: index historical (chain-sync covers all since Conway genesis) ──
    val coveredKeys = liveKeys + historical.map { "${it.txHash}:${it.index}" }
    val indexed = withContext(Dispatchers.IO) {
        GovernanceActionDao.getHistoricalFromIndex(network.name.lowercase(), epoch)
    }.filter { "${it.txHash}:${it.index}" !in coveredKeys }

    val all = live + historical + indexed

    // Collect DRep voters with an anchorUrl but no cached name — fetch server-side (bypasses CORS).
    // Cap the total wait at 10 s so the endpoint never hangs on slow IPFS gateways.
    val uncached = all.flatMap { it.votes }
        .filter { v -> v.role == "drep" && v.anchorUrl != null &&
            CardanoCache.drepInfo.getIfPresent("${network.name}:${v.id}") == null }
        .distinctBy { it.id }

    if (uncached.isNotEmpty()) {
        runCatching {
            withTimeout(10_000L) {
                coroutineScope {
                    uncached.map { vote ->
                        async {
                            val meta = runCatching { fetchDRepMeta(vote.anchorUrl!!) }.getOrNull()
                            val name     = meta?.name
                            val imageUrl = meta?.imageUrl
                            if (name != null || imageUrl != null) {
                                CardanoCache.drepInfo.put("${network.name}:${vote.id}", buildJsonObject {
                                    put("name",     name?.let { JsonPrimitive(it) } ?: JsonNull)
                                    put("imageUrl", imageUrl?.let { JsonPrimitive(it) } ?: JsonNull)
                                })
                            }
                        }
                    }.forEach { it.await() }
                }
            }
        }
    }

    // Batch-load titles from idx_governance_proposals for GAs that don't have one yet.
    val titleMap = withContext(Dispatchers.IO) {
        ChainIndexDao.buildGaTitleMap(network.name.lowercase())
    }

    // Enrich all DRep vote entries with names from (now-populated) drepInfo cache.
    // Also merge DB title for any GA missing one (active GAs parsed from Ogmios have title=null).
    return all.map { ga ->
        val enrichedTitle = ga.title ?: titleMap["${ga.txHash}#${ga.index}"]
        ga.copy(
            title = enrichedTitle,
            votes = ga.votes.map { vote ->
                if (vote.role == "drep") {
                    val nameEl = CardanoCache.drepInfo
                        .getIfPresent("${network.name}:${vote.id}")?.get("name")
                    val name = if (nameEl is JsonPrimitive) nameEl.contentOrNull else null
                    vote.copy(voterName = name)
                } else vote
            },
        )
    }
}

/**
 * Build a DRepStakeContext from the cached drepList.
 * Falls back to an Ogmios fetch if the cache is cold; falls back to EMPTY on error.
 */
private suspend fun getOrFetchDRepStakeContext(network: Network): DRepStakeContext {
    val cached = CardanoCache.drepList.getIfPresent(network.name)
    if (cached != null) return parseDRepStakeContext(cached)

    return try {
        val raw = OgmiosStateQueries(network).getDelegateRepresentatives()
        CardanoCache.drepList.put(network.name, raw)
        parseDRepStakeContext(raw)
    } catch (e: Exception) {
        DRepStakeContext.EMPTY
    }
}

/**
 * Fetch governance voting thresholds from cache; falls back to Ogmios, then DEFAULT.
 * Protocol params change only at epoch boundaries — cached for 24 hours.
 */
private suspend fun getOrFetchGovernanceThresholds(network: Network): GovernanceThresholds {
    val cached = CardanoCache.protocolParams.getIfPresent(network.name)
    if (cached != null) return runCatching { parseGovernanceThresholds(cached.jsonObject) }
        .getOrDefault(GovernanceThresholds.DEFAULT)

    return try {
        val raw = OgmiosStateQueries(network).getProtocolParameters()
        CardanoCache.protocolParams.put(network.name, raw)
        parseGovernanceThresholds(raw)
    } catch (e: Exception) {
        GovernanceThresholds.DEFAULT
    }
}

/**
 * Fetch current epoch from cache; falls back to Ogmios, then 0.
 * Epoch changes at most once per day — cached for 30 minutes.
 */
private suspend fun getOrFetchCurrentEpoch(network: Network): Int {
    CardanoCache.currentEpoch.getIfPresent(network.name)?.let { return it }

    return try {
        val epoch = OgmiosStateQueries(network).getCurrentEpoch()
        CardanoCache.currentEpoch.put(network.name, epoch)
        epoch
    } catch (e: Exception) {
        0
    }
}

/**
 * Fetch CC context (N_Active + quorum) from cache; falls back to Ogmios, then EMPTY.
 */
private suspend fun getOrFetchCCContext(network: Network): CCContext {
    val cached = CardanoCache.ccCommittee.getIfPresent(network.name)
    if (cached != null) return parseCCContext(cached)

    return try {
        val raw = OgmiosStateQueries(network).getConstitutionalCommittee()
        CardanoCache.ccCommittee.put(network.name, raw)
        parseCCContext(raw)
    } catch (e: Exception) {
        CCContext.EMPTY
    }
}

