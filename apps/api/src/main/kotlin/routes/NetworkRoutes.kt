package vote.tempo.routes

import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.*
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.networkFromString

/**
 * GET /network/stats?network=mainnet|preprod
 *
 * Returns lightweight ecosystem stats served entirely from in-memory caches:
 *   - currentEpoch    — from CardanoCache.currentEpoch (30-min TTL)
 *   - activeDRepCount — count of registered DReps (from CardanoCache.drepList)
 *   - totalDelegatedAda — sum of all active voting power across DReps (lovelace → ADA)
 *   - activeGACount   — number of governance proposals with status "active"
 *
 * All values are served from cache (no live Ogmios calls) so the response is fast.
 * Falls back gracefully if a cache entry is missing.
 */
fun Route.networkRoutes() {
    get("/network/stats") {
        val network = networkFromString(call.request.queryParameters["network"] ?: "mainnet")

        // ── Epoch ─────────────────────────────────────────────────────────────
        val epoch = CardanoCache.currentEpoch.getIfPresent(network.name)
            ?: runCatching {
                val e = OgmiosStateQueries(network).getCurrentEpoch()
                CardanoCache.currentEpoch.put(network.name, e)
                e
            }.getOrNull()

        // ── DRep count ────────────────────────────────────────────────────────
        val activeDRepCount = CardanoCache.drepList.getIfPresent(network.name)
            ?.let { el ->
                when (el) {
                    is JsonArray  -> el.size
                    is JsonObject -> el.values.firstOrNull()
                        ?.let { if (it is JsonArray) it.size else null }
                    else -> null
                }
            }

        // ── Total delegated ADA (lovelace → ADA) ──────────────────────────────
        val totalDelegatedAda = CardanoCache.drepStakeMap.getIfPresent(network.name)
            ?.values
            ?.sumOf { it }
            ?.let { it / 1_000_000L }

        // ── Active GA count ───────────────────────────────────────────────────
        val activeGACount = CardanoCache.parsedGovActions.getIfPresent(network.name)
            ?.count { it.status == "active" }

        call.respond(buildJsonObject {
            epoch?.let           { put("currentEpoch",      it) }
            activeDRepCount?.let { put("activeDRepCount",   it) }
            totalDelegatedAda?.let { put("totalDelegatedAda", it) }
            activeGACount?.let   { put("activeGACount",     it) }
        })
    }
}
