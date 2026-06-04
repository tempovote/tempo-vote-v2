package vote.tempo.routes

import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.healthRoutes() {
    get("/health") {
        call.respond(mapOf("status" to "ok", "version" to "0.1.0"))
    }
}

// Stubs — to be implemented in Week 2-3

fun Route.drepRoutes() {
    route("/dreps") {
        get { call.respond(mapOf("TODO" to "DRep list from Ogmios")) }
        get("/{drepId}") { call.respond(mapOf("TODO" to "DRep detail")) }
    }
}

fun Route.pollRoutes() {
    route("/polls") {
        get    { call.respond(mapOf("TODO" to "List internal polls")) }
        post   { call.respond(mapOf("TODO" to "Create poll")) }
        get    ("/{pollId}") { call.respond(mapOf("TODO" to "Poll detail")) }
        post   ("/{pollId}/vote") { call.respond(mapOf("TODO" to "Vote on poll")) }
        post   ("/{pollId}/comments") { call.respond(mapOf("TODO" to "Add comment")) }
    }
}

fun Route.communityRoutes() {
    route("/communities") {
        get    ("/{drepId}") { call.respond(mapOf("TODO" to "Get community")) }
        post   ("/{drepId}/activate") { call.respond(mapOf("TODO" to "Activate community")) }
    }
}

fun Route.metadataRoutes() {
    route("/metadata") {
        // POST /metadata/upload — upload CIP-119 JSON-LD to IPFS, return anchorUrl + anchorDataHash
        post("/upload") { call.respond(mapOf("TODO" to "Upload metadata to IPFS")) }
    }
}
