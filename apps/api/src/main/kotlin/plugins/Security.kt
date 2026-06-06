package vote.tempo.plugins

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.response.*

val JWT_SECRET: String  = System.getenv("JWT_SECRET") ?: "dev-secret-change-in-prod"
const val JWT_ISSUER   = "tempo.vote"
const val JWT_AUDIENCE = "tempo-api"

fun Application.configureSecurity() {
    val algorithm = Algorithm.HMAC256(JWT_SECRET)
    install(Authentication) {
        jwt("jwt") {
            realm = "Tempo Vote API"
            verifier(
                JWT.require(algorithm)
                    .withIssuer(JWT_ISSUER)
                    .withAudience(JWT_AUDIENCE)
                    .build()
            )
            validate { credential ->
                val sub     = credential.payload.subject
                val network = credential.payload.getClaim("network").asString()
                if (!sub.isNullOrBlank() && !network.isNullOrBlank()) JWTPrincipal(credential.payload)
                else null
            }
            challenge { _, _ ->
                call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Missing or invalid token"))
            }
        }
    }
}
