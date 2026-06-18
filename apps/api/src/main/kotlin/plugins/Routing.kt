package vote.tempo.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import vote.tempo.routes.*

fun Application.configureRouting() {
    routing {
        healthRoutes()
        networkRoutes()
        authRoutes()
        transactionRoutes()
        chainInfoRoutes()
        governanceRoutes()
        drepRoutes()
        stakeRoutes()
        pollRoutes()
        communityRoutes()
        allianceRoutes()
        allianceProposalRoutes()
        metadataRoutes()
        walletRoutes()
        dappRankingRoutes()
    }
}
