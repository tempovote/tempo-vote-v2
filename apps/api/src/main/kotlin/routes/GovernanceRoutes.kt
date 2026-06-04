package vote.tempo.routes

import io.ktor.server.response.*
import io.ktor.server.routing.*
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.networkFromString

fun Route.governanceRoutes() {
    route("/governance-actions") {

        // GET /governance-actions?network=preprod
        get {
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val queries = OgmiosStateQueries(network)
            val result = queries.getGovernanceActions()
            call.respond(result)
        }

        // GET /governance-actions/{txHash}?network=preprod&index=0
        get("/{txHash}") {
            val txHash = call.parameters["txHash"] ?: return@get call.respond(mapOf("error" to "txHash required"))
            // TODO: filter from full list by txHash
            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val queries = OgmiosStateQueries(network)
            val result = queries.getGovernanceActions()
            call.respond(result) // TODO: filter by txHash
        }
    }
}
