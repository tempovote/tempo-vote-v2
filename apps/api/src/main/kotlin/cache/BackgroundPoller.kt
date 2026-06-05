package vote.tempo.cache

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.server.application.*
import kotlinx.coroutines.*
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries

private val logger = KotlinLogging.logger("BackgroundPoller")

private const val POLL_INTERVAL_MS = 5 * 60 * 1_000L   // 5 minutes
private const val STARTUP_DELAY_MS = 3_000L             // wait for server to finish starting

/**
 * Starts a long-running coroutine that periodically queries Ogmios for global
 * Cardano state and writes the results into CardanoCache.
 *
 * - DRep list          → every 5 minutes
 * - Governance actions → every 5 minutes
 *
 * If a network's Ogmios is unreachable the error is logged and the existing
 * cache entry remains valid until its TTL expires (stale-while-revalidate pattern).
 * The poller is cancelled cleanly when the Ktor application stops.
 */
fun Application.startBackgroundPoller() {
    val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    monitor.subscribe(ApplicationStopped) {
        logger.info { "BackgroundPoller stopping" }
        scope.cancel()
    }

    scope.launch {
        delay(STARTUP_DELAY_MS)
        logger.info { "BackgroundPoller first poll starting" }
        while (isActive) {
            pollAllNetworks()
            delay(POLL_INTERVAL_MS)
        }
    }

    logger.info { "BackgroundPoller scheduled — Cardano global state refreshes every 5 minutes" }
}

private suspend fun pollAllNetworks() {
    // Only poll networks with an explicitly configured Ogmios URL.
    // PREPROD falls back to localhost in OgmiosStateQueries, so skip it unless
    // OGMIOS_PREPROD_URL is set — avoids noisy WARN logs when PREPROD is restricted.
    if (System.getenv("OGMIOS_MAINNET_URL") != null) pollNetwork(Network.MAINNET)
    if (System.getenv("OGMIOS_PREPROD_URL") != null) pollNetwork(Network.PREPROD)
}

private suspend fun pollNetwork(network: Network) {
    runCatching {
        val q = OgmiosStateQueries(network)

        val dreps = q.getDelegateRepresentatives()
        CardanoCache.drepList.put(network.name, dreps)

        val gas = q.getGovernanceActions()
        CardanoCache.govActions.put(network.name, gas)

        logger.debug { "BackgroundPoller [$network] refreshed drepList + govActions" }
    }.onFailure { e ->
        // Don't crash — stale cache is better than no cache
        logger.warn { "BackgroundPoller [$network] failed: ${e.message}" }
    }
}
