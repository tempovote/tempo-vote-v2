package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.*
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.DRepStakeContext
import vote.tempo.cardano.GovernanceActionDto
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.cardano.CCContext
import vote.tempo.cardano.GovernanceThresholds
import vote.tempo.cardano.mapOgmiosProposal
import vote.tempo.cardano.networkFromString
import vote.tempo.cardano.parseCCContext
import vote.tempo.cardano.parseDRepStakeContext
import vote.tempo.cardano.parseGovernanceThresholds

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
    route("/governance-actions") {

        /**
         * GET /governance-actions?network=preprod&type=treasuryWithdrawals
         * Returns mapped GovernanceActionDto list — served from cache (refreshed every 5 min).
         */
        get {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val typeFilter = call.request.queryParameters["type"]

            val proposals = fetchProposals(network)

            val filtered = if (typeFilter != null) {
                proposals.filter { it.actionType.equals(typeFilter, ignoreCase = true) }
            } else proposals

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
            } else {
                call.respond(proposal)
            }
        }
    }
}

/**
 * Fetch governance proposals — try cache first, fall back to Ogmios.
 * Also fetches DRep stake context, CC context, governance thresholds,
 * and current epoch for accurate status computation.
 */
private suspend fun fetchProposals(network: Network): List<GovernanceActionDto> {
    val stakeCtx   = getOrFetchDRepStakeContext(network)
    val ccCtx      = getOrFetchCCContext(network)
    val thresholds = getOrFetchGovernanceThresholds(network)
    val epoch      = getOrFetchCurrentEpoch(network)

    CardanoCache.govActions.getIfPresent(network.name)?.let { cached ->
        return parseProposalsFromCache(cached, stakeCtx, ccCtx, thresholds, epoch)
    }

    return try {
        val raw = OgmiosStateQueries(network).getGovernanceProposals()
        CardanoCache.govActions.put(network.name, raw)
        parseProposalsFromCache(raw, stakeCtx, ccCtx, thresholds, epoch)
    } catch (e: Exception) {
        emptyList()
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

private fun parseProposalsFromCache(
    raw: JsonElement,
    stakeCtx:   DRepStakeContext,
    ccCtx:      CCContext = CCContext.EMPTY,
    thresholds: GovernanceThresholds = GovernanceThresholds.DEFAULT,
    currentEpoch: Int = 0,
): List<GovernanceActionDto> {
    val array = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["governanceProposals"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return emptyList()
        else          -> return emptyList()
    }
    return array.mapNotNull { item ->
        runCatching { mapOgmiosProposal(item.jsonObject, stakeCtx, ccCtx, thresholds, currentEpoch) }.getOrNull()
    }
}
