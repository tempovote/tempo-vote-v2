package vote.tempo.routes

import io.ktor.server.response.*
import io.ktor.server.routing.*
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.networkFromString

fun Route.governanceRoutes() {
    route("/governance-actions") {

        // GET /governance-actions?network=preprod
        // Served from CardanoCache.govActions (pre-warmed by BackgroundPoller every 5 min).
        get {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            CardanoCache.govActions.getIfPresent(network.name)?.let { cached ->
                call.respond(cached)
                return@get
            }

            val queries = OgmiosStateQueries(network)
            val result = queries.getGovernanceActions()
            CardanoCache.govActions.put(network.name, result)
            call.respond(result)
        }

        // GET /governance-actions/{txHash}?network=preprod
        // TODO: filter by txHash — currently returns full list
        get("/{txHash}") {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")

            CardanoCache.govActions.getIfPresent(network.name)?.let { cached ->
                call.respond(cached)
                return@get
            }

            val queries = OgmiosStateQueries(network)
            val result = queries.getGovernanceActions()
            CardanoCache.govActions.put(network.name, result)
            call.respond(result)
        }
    }
}
