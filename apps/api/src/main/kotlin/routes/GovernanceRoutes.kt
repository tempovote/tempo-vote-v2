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
import vote.tempo.cardano.mapOgmiosProposal
import vote.tempo.cardano.networkFromString
import vote.tempo.cardano.parseActiveCCMemberCount
import vote.tempo.cardano.parseDRepStakeContext

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

            // Get raw proposals (cache-first)
            val raw = CardanoCache.govActions.getIfPresent(network.name) ?: run {
                val r = OgmiosStateQueries(network).getGovernanceProposals()
                CardanoCache.govActions.put(network.name, r)
                r
            }

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
 * Also fetches DRep stake context and active CC member count for accurate vote display.
 */
private suspend fun fetchProposals(network: Network): List<GovernanceActionDto> {
    val stakeCtx = getOrFetchDRepStakeContext(network)
    val ccActiveMembers = getOrFetchCCActiveMembers(network)

    CardanoCache.govActions.getIfPresent(network.name)?.let { cached ->
        return parseProposalsFromCache(cached, stakeCtx, ccActiveMembers)
    }

    return try {
        val raw = OgmiosStateQueries(network).getGovernanceProposals()
        CardanoCache.govActions.put(network.name, raw)
        parseProposalsFromCache(raw, stakeCtx, ccActiveMembers)
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
 * Fetch active CC member count from cache; falls back to Ogmios, then 0.
 * N_Active = how many CC members are currently active (not resigned/expired).
 */
private suspend fun getOrFetchCCActiveMembers(network: Network): Int {
    val cached = CardanoCache.ccCommittee.getIfPresent(network.name)
    if (cached != null) return parseActiveCCMemberCount(cached)

    return try {
        val raw = OgmiosStateQueries(network).getConstitutionalCommittee()
        CardanoCache.ccCommittee.put(network.name, raw)
        parseActiveCCMemberCount(raw)
    } catch (e: Exception) {
        0
    }
}

private fun parseProposalsFromCache(
    raw: JsonElement,
    stakeCtx: DRepStakeContext,
    ccActiveMembers: Int = 0,
): List<GovernanceActionDto> {
    val array = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["governanceProposals"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return emptyList()
        else          -> return emptyList()
    }
    return array.mapNotNull { item ->
        runCatching { mapOgmiosProposal(item.jsonObject, stakeCtx, ccActiveMembers) }.getOrNull()
    }
}
