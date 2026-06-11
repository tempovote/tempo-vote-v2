package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*

private val logger = KotlinLogging.logger("BlockfrostClient")

private val blockfrostHttp = HttpClient(CIO) {
    engine { requestTimeout = 0 }
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
