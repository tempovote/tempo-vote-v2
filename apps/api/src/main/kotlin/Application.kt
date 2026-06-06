package vote.tempo

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import vote.tempo.cache.startBackgroundPoller
import vote.tempo.cardano.runVoteIndexer
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
    startVoteIndexers()
}

fun Application.startVoteIndexers() {
    val scope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.Dispatchers.IO + kotlinx.coroutines.SupervisorJob()
    )
    monitor.subscribe(ApplicationStopped) { scope.cancel() }

    System.getenv("OGMIOS_MAINNET_URL")?.let { url ->
        scope.launch { runVoteIndexer("mainnet", url) }
    }
    System.getenv("OGMIOS_PREPROD_URL")?.let { url ->
        scope.launch { runVoteIndexer("preprod", url) }
    }
}
