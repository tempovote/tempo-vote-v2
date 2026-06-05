package vote.tempo

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import vote.tempo.cache.startBackgroundPoller
import vote.tempo.plugins.*

fun main() {
    val port = System.getenv("API_PORT")?.toInt() ?: 8080
    embeddedServer(Netty, port = port, host = "0.0.0.0", module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    configureSerialization()
    configureCors()
    configureStatusPages()
    configureDatabase()
    configureRouting()
    startBackgroundPoller()
}
