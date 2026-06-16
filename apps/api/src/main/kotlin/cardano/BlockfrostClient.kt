package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import java.io.IOException

private val logger = KotlinLogging.logger("BlockfrostClient")

/** Pool stake + metadata fetched from Blockfrost for a single pool. */
data class BlockfrostPoolInfo(
    val poolIdHex: String,       // 28-byte pool key hash in hex (from Blockfrost `hex` field)
    val liveStake: Long,         // live delegated stake in lovelace (= governance voting power)
    val name: String?,
    val ticker: String?,
)

private val blockfrostHttp = HttpClient(CIO) {
    engine { requestTimeout = 0 }
    // Blockfrost free tier caps at 10 req/s. On 429 (rate limit) or 5xx, back off and
    // retry instead of silently dropping the data. exponentialDelay() honours the
    // Retry-After header that Blockfrost sends with a 429.
    install(HttpRequestRetry) {
        maxRetries = 3
        retryIf { _, response -> response.status.value == 429 || response.status.value in 500..599 }
        retryOnExceptionIf { _, cause -> cause is IOException }
        exponentialDelay(base = 2.0, maxDelayMs = 8_000)
    }
}

private val blockfrostJson = Json { ignoreUnknownKeys = true }

fun blockfrostProjectId(network: Network): String? = when (network) {
    Network.MAINNET -> System.getenv("BLOCKFROST_MAINNET_PROJECT_ID")
    else            -> System.getenv("BLOCKFROST_PREPROD_PROJECT_ID")
}

private fun blockfrostBaseUrl(network: Network) = when (network) {
    Network.MAINNET -> "https://cardano-mainnet.blockfrost.io/api/v0"
    else            -> "https://cardano-preprod.blockfrost.io/api/v0"
}

/**
 * Fetch pool live stake and metadata for a single SPO from Blockfrost.
 * Makes two calls:
 *   1. GET /pools/{poolId}          → hex (pool key hash), live_stake
 *   2. GET /pools/{poolId}/metadata → name, ticker  (404 = no metadata registered)
 *
 * Returns null if Blockfrost is not configured or the pool call fails.
 * A 404 on the metadata call is treated as name=null, ticker=null (not a failure).
 */
suspend fun fetchPoolInfoBlockfrost(
    poolIdBech32: String,   // bech32 format, pool1...
    network: Network,
): BlockfrostPoolInfo? {
    val projectId = blockfrostProjectId(network) ?: return null
    val base      = blockfrostBaseUrl(network)

    return runCatching {
        withTimeout(15_000L) {
            // ── 1. Pool stats (hex + live_stake) ──────────────────────────────
            val statsResp = blockfrostHttp.get("$base/pools/$poolIdBech32") {
                header("project_id", projectId)
            }
            if (!statsResp.status.isSuccess()) {
                logger.warn { "Blockfrost GET /pools/$poolIdBech32 → HTTP ${statsResp.status.value} [$network]" }
                return@withTimeout null
            }
            val statsJson  = blockfrostJson.parseToJsonElement(statsResp.bodyAsText()).jsonObject
            val poolIdHex  = statsJson["hex"]?.jsonPrimitive?.contentOrNull ?: return@withTimeout null
            val liveStake  = statsJson["live_stake"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L

            // ── 2. Pool metadata (name + ticker) ──────────────────────────────
            val metaResp = blockfrostHttp.get("$base/pools/$poolIdBech32/metadata") {
                header("project_id", projectId)
            }
            val name: String?
            val ticker: String?
            if (metaResp.status == HttpStatusCode.NotFound) {
                name   = null
                ticker = null
            } else if (metaResp.status.isSuccess()) {
                val metaJson = blockfrostJson.parseToJsonElement(metaResp.bodyAsText()).jsonObject
                name   = metaJson["name"]?.jsonPrimitive?.contentOrNull
                ticker = metaJson["ticker"]?.jsonPrimitive?.contentOrNull
            } else {
                logger.warn { "Blockfrost GET /pools/$poolIdBech32/metadata → HTTP ${metaResp.status.value} [$network]" }
                name   = null
                ticker = null
            }

            BlockfrostPoolInfo(poolIdHex = poolIdHex, liveStake = liveStake, name = name, ticker = ticker)
        }
    }.onFailure { e ->
        logger.warn { "Blockfrost fetchPoolInfo failed for $poolIdBech32 [$network]: ${e.message}" }
    }.getOrNull()
}

/**
 * Fetch all delegators of a DRep from Blockfrost with their active stake amounts.
 * Paginates automatically (100 rows per page) until all delegators are fetched.
 *
 * Returns list of (stakeAddress, lovelaceAmount) pairs.
 * Returns empty list if:
 *  - BLOCKFROST_{NETWORK}_PROJECT_ID is not configured
 *  - Blockfrost returns an error
 *  - Request times out
 */
suspend fun fetchDRepDelegatorsBlockfrost(
    drepId: String,     // bech32 CIP-105 format (drep1...)
    network: Network,
): List<Pair<String, Long>> {
    val projectId = blockfrostProjectId(network) ?: run {
        logger.debug { "Blockfrost project_id not configured for $network — skipping" }
        return emptyList()
    }

    val base   = blockfrostBaseUrl(network)
    val result = mutableListOf<Pair<String, Long>>()

    return runCatching {
        withTimeout(120_000L) {
            var page = 1
            while (true) {
                val resp = blockfrostHttp.get("$base/governance/dreps/$drepId/delegators") {
                    header("project_id", projectId)
                    parameter("count", 100)
                    parameter("page",  page)
                }
                if (!resp.status.isSuccess()) {
                    logger.warn { "Blockfrost drep delegators HTTP ${resp.status.value} for $drepId [$network] (page $page)" }
                    break
                }
                val text     = resp.bodyAsText()
                val pageData = blockfrostJson.parseToJsonElement(text).jsonArray
                for (item in pageData) {
                    val obj     = item.jsonObject
                    val address = obj["address"]?.jsonPrimitive?.contentOrNull  ?: continue
                    // Blockfrost returns amount as a string to avoid JS precision loss
                    val amount  = obj["amount"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: continue
                    result.add(address to amount)
                }
                if (pageData.size < 100) break
                page++
            }
            result
        }
    }.onFailure { e ->
        logger.warn { "Blockfrost fetchDRepDelegators failed for $drepId [$network]: ${e.message}" }
    }.getOrDefault(emptyList())
}

/**
 * Enumerate all governance proposals for the network and return those with enacted_epoch set.
 * Steps:
 *   1. Paginate /governance/proposals to collect all (tx_hash, cert_index) pairs.
 *   2. Fetch detail for each proposal in parallel (capped at 10 concurrent requests).
 *   3. Return pairs where enacted_epoch != null.
 *
 * Used by the backfill-enacted admin route to update final_status in idx_governance_proposals.
 */
suspend fun fetchEnactedProposalKeys(network: Network): List<Pair<String, Int>> {
    val projectId = blockfrostProjectId(network)
        ?: return emptyList<Pair<String, Int>>().also {
            logger.warn { "Blockfrost not configured for $network — skipping enacted backfill" }
        }
    val base = blockfrostBaseUrl(network)

    return runCatching {
        withTimeout(120_000L) {
            // ── Step 1: collect all proposal stubs (tx_hash + cert_index) ────────────
            val stubs = mutableListOf<Pair<String, Int>>()
            var page = 1
            while (true) {
                val resp = blockfrostHttp.get("$base/governance/proposals?count=100&page=$page&order=asc") {
                    header("project_id", projectId)
                }
                if (!resp.status.isSuccess()) break
                val arr = blockfrostJson.parseToJsonElement(resp.bodyAsText()).jsonArray
                for (item in arr) {
                    val obj   = item.jsonObject
                    val txHash   = obj["tx_hash"]?.jsonPrimitive?.contentOrNull  ?: continue
                    val certIdx  = obj["cert_index"]?.jsonPrimitive?.intOrNull   ?: continue
                    stubs.add(txHash to certIdx)
                }
                if (arr.size < 100) break
                page++
            }
            logger.info { "Blockfrost [$network] found ${stubs.size} total governance proposals" }

            // ── Step 2: fetch detail per proposal, 8 in parallel, ~1 s between chunks ──
            // Keeps the burst under Blockfrost's 10 req/s cap (HttpRequestRetry covers the rest).
            val enacted = mutableListOf<Pair<String, Int>>()
            stubs.chunked(8).forEachIndexed { chunkIdx, chunk ->
                if (chunkIdx > 0) delay(1_000L)
                coroutineScope {
                    chunk.map { (txHash, certIdx) ->
                        async {
                            runCatching {
                                val detailResp = blockfrostHttp.get(
                                    "$base/governance/proposals/$txHash/$certIdx"
                                ) { header("project_id", projectId) }
                                if (!detailResp.status.isSuccess()) return@runCatching
                                val detail = blockfrostJson.parseToJsonElement(
                                    detailResp.bodyAsText()
                                ).jsonObject
                                val enactedEpoch = detail["enacted_epoch"]?.jsonPrimitive
                                    ?.intOrNull
                                if (enactedEpoch != null) {
                                    synchronized(enacted) { enacted.add(txHash to certIdx) }
                                }
                            }.onFailure { e ->
                                logger.debug { "Detail fetch failed for $txHash/$certIdx: ${e.message}" }
                            }
                        }
                    }.awaitAll()
                }
            }
            logger.info { "Blockfrost [$network] identified ${enacted.size} enacted proposals" }
            enacted
        }
    }.onFailure { e ->
        logger.warn { "fetchEnactedProposalKeys [$network] failed: ${e.message}" }
    }.getOrDefault(emptyList())
}
