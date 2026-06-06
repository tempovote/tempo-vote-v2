package vote.tempo.plugins

import io.ktor.server.application.*
import io.ktor.server.routing.*
import vote.tempo.routes.*

fun Application.configureRouting() {
    routing {
        healthRoutes()
        authRoutes()
        transactionRoutes()
        governanceRoutes()
        drepRoutes()
        stakeRoutes()
        pollRoutes()
        communityRoutes()
        metadataRoutes()
        walletRoutes()
    }
}
