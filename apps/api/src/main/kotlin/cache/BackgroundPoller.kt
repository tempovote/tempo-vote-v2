package vote.tempo.cache

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.server.application.*
import kotlinx.coroutines.*
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries

private val logger = KotlinLogging.logger("BackgroundPoller")

private const val POLL_INTERVAL_MS = 5 * 60 * 1_000L    // 5 minutes (normal cadence)
private const val QUERY_TIMEOUT_MS = 60_000L             // 60 s hard cap per network poll
private const val MAX_BACKOFF_MS   = 30 * 60 * 1_000L   // 30 minutes max backoff
private const val STARTUP_DELAY_MS = 3_000L

// Per-network state for exponential backoff
private val consecutiveFailures = mutableMapOf<Network, Int>()
private val nextPollTime        = mutableMapOf<Network, Long>()

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
    // Skip if still within backoff window from a previous failure
    val now = System.currentTimeMillis()
    val resumeAt = nextPollTime[network] ?: 0L
    if (resumeAt > now) {
        logger.debug { "BackgroundPoller [$network] skipped — backoff until ${(resumeAt - now) / 1000}s from now" }
        return
    }

    runCatching {
        withTimeout(QUERY_TIMEOUT_MS) {
            val q = OgmiosStateQueries(network)

            val dreps = q.getDelegateRepresentatives()
            CardanoCache.drepList.put(network.name, dreps)

            val gas = q.getGovernanceProposals()
            CardanoCache.govActions.put(network.name, gas)
            CardanoCache.parsedGovActions.invalidate(network.name)
        }
        // Success — reset backoff
        consecutiveFailures.remove(network)
        nextPollTime.remove(network)
        logger.debug { "BackgroundPoller [$network] refreshed drepList + govActions" }
    }.onFailure { e ->
        val failures = (consecutiveFailures[network] ?: 0) + 1
        consecutiveFailures[network] = failures
        // Exponential backoff: 5m, 10m, 20m, capped at 30m
        val backoff = minOf(POLL_INTERVAL_MS * (1L shl (failures - 1).coerceAtMost(3)), MAX_BACKOFF_MS)
        nextPollTime[network] = System.currentTimeMillis() + backoff
        logger.warn { "BackgroundPoller [$network] failed ($failures consecutive): ${e.message} — next retry in ${backoff / 60_000}m" }
    }
}
