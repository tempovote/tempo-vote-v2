package vote.tempo.cardano

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val logger = KotlinLogging.logger("DappRankingClient")

private val llamaHttp = HttpClient(CIO) { engine { requestTimeout = 0 } }
private val llamaJson = Json { ignoreUnknownKeys = true }

private const val LLAMA = "https://api.llama.fi"
private const val COINS = "https://coins.llama.fi"
private val DATE_FMT = DateTimeFormatter.ofPattern("dd MMM", Locale.ENGLISH)

// ── FE-shaped payload (matches apps/web CardanoProtocol / ChartPoint) ──────────

@Serializable
data class DappProtocol(
    val rank: Int,
    val name: String,
    val slug: String,
    val logo: String,
    val category: String,
    val tvl: Double,
    val change1d: Double,
    val change7d: Double,
    val volume24h: Double?,
    val fees24h: Double?,
    val revenue24h: Double?,
    val url: String,
)

@Serializable
data class TvlPoint(val label: String, val tvl: Double)

@Serializable
data class DappRankingSnapshot(
    val protocols: List<DappProtocol>,
    val tvlHistory: List<TvlPoint>,
    val totalTvl: Double,
    val change24h: Double,
    val adaPrice: Double,
    val updatedAt: String,
)

// ── Fetch helpers (each isolated; failure falls back to a default) ─────────────

private suspend fun getJson(url: String): JsonElement? = runCatching {
    withTimeout(25_000L) {
        val resp = llamaHttp.get(url)
        if (!resp.status.isSuccess()) return@withTimeout null
        llamaJson.parseToJsonElement(resp.bodyAsText())
    }
}.onFailure { logger.warn { "DefiLlama GET $url failed: ${it.message}" } }.getOrNull()

private fun JsonObject.dbl(key: String): Double? = this[key]?.jsonPrimitive?.doubleOrNull
private fun JsonObject.str(key: String): String? = this[key]?.jsonPrimitive?.contentOrNull

/** Build slug → field map from a DefiLlama /overview response ({ protocols: [{slug, ...}] }). */
private fun overviewMap(el: JsonElement?, field: String): Map<String, Double> {
    val arr = (el as? JsonObject)?.get("protocols")?.jsonArray ?: return emptyMap()
    val out = HashMap<String, Double>()
    for (item in arr) {
        val o = item.jsonObject
        val slug = o.str("slug") ?: continue
        o.dbl(field)?.let { out[slug] = it }
    }
    return out
}

/**
 * Fetch + transform the full Cardano DApp ranking from DefiLlama (5 endpoints).
 * Returns null only when both the protocol list AND the TVL history come back empty
 * (total outage) — callers should then keep the previous snapshot rather than overwrite.
 */
suspend fun fetchDappRankingSnapshot(): DappRankingSnapshot? {
    val protocolsRaw = getJson("$LLAMA/protocols") as? JsonArray ?: JsonArray(emptyList())
    val dexEl  = getJson("$LLAMA/overview/dexs?chain=Cardano&excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true")
    val feesEl = getJson("$LLAMA/overview/fees?chain=Cardano&excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true")
    val tvlEl  = getJson("$LLAMA/v2/historicalChainTvl/Cardano") as? JsonArray ?: JsonArray(emptyList())
    val coinsEl = getJson("$COINS/prices/current/coingecko:cardano")

    val volMap  = overviewMap(dexEl, "total24h")
    val feesMap = overviewMap(feesEl, "total24h")
    val revMap  = overviewMap(feesEl, "totalRevenue24h")

    // Protocols: keep Cardano, sort by TVL desc, attach volume/fees/revenue.
    val cardano = protocolsRaw
        .mapNotNull { it as? JsonObject }
        .filter { it.str("chain") == "Cardano" }
        .sortedByDescending { it.dbl("tvl") ?: 0.0 }
        .mapIndexed { i, p ->
            val slug = p.str("slug") ?: ""
            DappProtocol(
                rank       = i + 1,
                name       = p.str("name") ?: slug,
                slug       = slug,
                logo       = p.str("logo") ?: "",
                category   = p.str("category") ?: "Unknown",
                tvl        = p.dbl("tvl") ?: 0.0,
                change1d   = p.dbl("change_1d") ?: 0.0,
                change7d   = p.dbl("change_7d") ?: 0.0,
                volume24h  = volMap[slug],
                fees24h    = feesMap[slug],
                revenue24h = revMap[slug],
                url        = p.str("url")?.takeIf { it.isNotBlank() } ?: "https://defillama.com/protocol/$slug",
            )
        }

    // TVL history: last 90 days, TVL expressed in millions with 2 decimals (mirrors FE).
    val history = tvlEl.mapNotNull { it as? JsonObject }
    val tvlHistory = history.takeLast(90).mapNotNull { e ->
        val date = e["date"]?.jsonPrimitive?.longOrNull ?: return@mapNotNull null
        val tvl  = e.dbl("tvl") ?: return@mapNotNull null
        val label = Instant.ofEpochSecond(date).atZone(ZoneOffset.UTC).toLocalDate().format(DATE_FMT)
        TvlPoint(label = label, tvl = Math.round(tvl / 1e4) / 100.0)
    }

    val last = history.lastOrNull()?.dbl("tvl") ?: 0.0
    val prev = history.getOrNull(history.size - 2)?.dbl("tvl") ?: 0.0
    val change24h = if (prev > 0.0) (last - prev) / prev * 100.0 else 0.0

    val adaPrice = (coinsEl as? JsonObject)?.get("coins")?.jsonObject
        ?.get("coingecko:cardano")?.jsonObject?.dbl("price") ?: 0.0

    if (cardano.isEmpty() && tvlHistory.isEmpty()) {
        logger.warn { "DApp ranking fetch produced no data — keeping previous snapshot" }
        return null
    }

    return DappRankingSnapshot(
        protocols  = cardano,
        tvlHistory = tvlHistory,
        totalTvl   = last,
        change24h  = change24h,
        adaPrice   = adaPrice,
        updatedAt  = Instant.now().toString(),
    )
}
