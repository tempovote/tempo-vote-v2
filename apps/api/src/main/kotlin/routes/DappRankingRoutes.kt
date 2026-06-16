package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.DappRankingSnapshot
import vote.tempo.cardano.fetchDappRankingSnapshot
import vote.tempo.db.DappRankingDao

private val dappJson = Json { ignoreUnknownKeys = true }

/**
 * GET /dapp-ranking — Cardano DApp ranking (TVL/volume/fees) sourced from DefiLlama.
 * Served from cache (L1, 30 min) → DB snapshot (L2, refreshed every 2 h by BackgroundPoller)
 * → on-demand fetch (L3, only on a cold DB before the first poll). The browser never calls
 * DefiLlama directly.
 */
fun Route.dappRankingRoutes() {
    get("/dapp-ranking") {
        CardanoCache.dappRanking.getIfPresent("cardano")?.let {
            call.respond(it)
            return@get
        }

        withContext(Dispatchers.IO) { DappRankingDao.get() }?.let { fromDb ->
            val el = dappJson.parseToJsonElement(fromDb)
            CardanoCache.dappRanking.put("cardano", el)
            call.respond(el)
            return@get
        }

        // Cold start: DB empty before the first scheduled refresh — fetch once on demand.
        val snapshot = fetchDappRankingSnapshot()
            ?: return@get call.respond(
                HttpStatusCode.ServiceUnavailable,
                mapOf("error" to "DApp ranking temporarily unavailable"),
            )
        val jsonStr = dappJson.encodeToString(DappRankingSnapshot.serializer(), snapshot)
        withContext(Dispatchers.IO) { DappRankingDao.upsert(jsonStr) }
        val el = dappJson.parseToJsonElement(jsonStr)
        CardanoCache.dappRanking.put("cardano", el)
        call.respond(el)
    }
}
