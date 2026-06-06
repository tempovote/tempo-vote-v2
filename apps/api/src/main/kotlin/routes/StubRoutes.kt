package vote.tempo.routes

import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.healthRoutes() {
    get("/health") {
        call.respond(mapOf("status" to "ok", "version" to "0.1.0"))
    }
}

fun Route.pollRoutes() {
    route("/polls") {
        get    { call.respond(mapOf("TODO" to "List internal polls")) }
        post   { call.respond(mapOf("TODO" to "Create poll")) }
        get    ("/{pollId}") { call.respond(mapOf("TODO" to "Poll detail")) }
        post   ("/{pollId}/vote") { call.respond(mapOf("TODO" to "Vote on poll")) }
    }
}
