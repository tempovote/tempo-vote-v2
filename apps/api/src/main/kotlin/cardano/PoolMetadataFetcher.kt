package vote.tempo.cardano

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import vote.tempo.db.ChainIndexDao

private val logger = KotlinLogging.logger("PoolMetadataFetcher")

private const val FETCH_TIMEOUT_MS   = 10_000L
private const val CONCURRENCY_LIMIT  = 8
private const val RETRY_INTERVAL_MS  = 60 * 60 * 1_000L   // re-check every hour for newly indexed pools

private val poolHttpClient = HttpClient(CIO) {
    engine { requestTimeout = FETCH_TIMEOUT_MS }
}

/**
 * Background job that reads idx_pool_metadata rows with a metadata_url but no name,
 * fetches CIP-6 JSON from each URL, and writes name/ticker back to DB.
 *
 * Runs once on startup (after a short delay) then every hour.
 * Concurrency is capped at CONCURRENCY_LIMIT to avoid hammering metadata servers.
 */
suspend fun runPoolMetadataFetcher(networks: List<String>) {
    delay(30_000L)  // let VoteIndexer index first pools before we start fetching
    while (true) {
        for (network in networks) {
            try {
                fetchMissingPoolMetadata(network)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                logger.warn { "PoolMetadataFetcher [$network] error: ${e.message}" }
            }
        }
        delay(RETRY_INTERVAL_MS)
    }
}

private suspend fun fetchMissingPoolMetadata(network: String) {
    val pending = withContext(Dispatchers.IO) {
        ChainIndexDao.getPoolsNeedingMetadata(network)
    }
    if (pending.isEmpty()) return

    logger.info { "PoolMetadataFetcher [$network] fetching metadata for ${pending.size} pools" }
    var updated = 0

    pending.chunked(CONCURRENCY_LIMIT).forEach { batch ->
        coroutineScope {
            batch.map { (poolIdHex, url) ->
                async {
                    val meta = runCatching { fetchCip6Meta(url) }.getOrNull()
                    if (meta != null) {
                        withContext(Dispatchers.IO) {
                            ChainIndexDao.updatePoolName(network, poolIdHex, meta.first, meta.second)
                        }
                        updated++
                    }
                }
            }.awaitAll()
        }
    }

    if (updated > 0) logger.info { "PoolMetadataFetcher [$network] updated $updated pool names" }
}

/** Fetch CIP-6 pool metadata JSON. Returns (name, ticker) or null on failure. */
private suspend fun fetchCip6Meta(url: String): Pair<String?, String?>? {
    val response = withTimeout(FETCH_TIMEOUT_MS) {
        poolHttpClient.get(url)
    }
    if (!response.status.value.let { it in 200..299 }) return null

    val json = runCatching {
        Json.parseToJsonElement(response.bodyAsText()).jsonObject
    }.getOrNull() ?: return null

    val name   = json["name"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
    val ticker = json["ticker"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }

    return if (name == null && ticker == null) null else (name to ticker)
}
