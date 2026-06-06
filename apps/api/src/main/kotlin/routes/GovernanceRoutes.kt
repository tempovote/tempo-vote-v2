package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.*
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.GovernanceActionDto
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.mapOgmiosProposal
import vote.tempo.cardano.networkFromString

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
 * Caches the parsed DTO list separately from the raw JSON.
 */
private suspend fun fetchProposals(network: vote.tempo.cardano.Network): List<GovernanceActionDto> {
    // Check DTO cache (String key → serialized list, stored as JsonElement)
    CardanoCache.govActions.getIfPresent(network.name)?.let { cached ->
        return parseProposalsFromCache(cached)
    }

    // Cache miss — query Ogmios
    return try {
        val queries = OgmiosStateQueries(network)
        val raw = queries.getGovernanceProposals()
        CardanoCache.govActions.put(network.name, raw)
        parseProposalsFromCache(raw)
    } catch (e: Exception) {
        emptyList()
    }
}

private fun parseProposalsFromCache(raw: JsonElement): List<GovernanceActionDto> {
    val array = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["governanceProposals"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return emptyList()
        else          -> return emptyList()
    }
    return array.mapNotNull { item ->
        runCatching { mapOgmiosProposal(item.jsonObject) }.getOrNull()
    }
}
