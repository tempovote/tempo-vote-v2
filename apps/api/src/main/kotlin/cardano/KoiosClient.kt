package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*
import io.github.oshai.kotlinlogging.KotlinLogging
import vote.tempo.cache.CardanoCache

private val logger = KotlinLogging.logger("KoiosClient")

data class PoolInfo(
    val name: String?,
    val votingPower: Long,
)

private val koiosJson = Json { ignoreUnknownKeys = true }

private val koiosHttp = HttpClient(CIO) {
    install(ContentNegotiation) { json(koiosJson) }
}

private fun koiosBaseUrl(network: Network) = when (network) {
    Network.MAINNET -> "https://api.koios.rest/api/v1"
    else            -> "https://preprod.koios.rest/api/v1"
}

/**
 * Batch-fetch pool metadata (name, voting_power) from Koios.
 * Pool IDs from Ogmios are already in bech32 format (pool1...) — passed directly to Koios.
 * Returns a map of bech32PoolId → PoolInfo; same key format as VoteEntry.id for SPO.
 */
suspend fun fetchPoolInfo(bech32PoolIds: List<String>, network: Network): Map<String, PoolInfo> {
    if (bech32PoolIds.isEmpty()) return emptyMap()

    val result = mutableMapOf<String, PoolInfo>()
    val toFetch = mutableListOf<String>()

    for (bech32Id in bech32PoolIds) {
        val cached = CardanoCache.poolInfo.getIfPresent("${network.name}:$bech32Id")
        if (cached != null) result[bech32Id] = cached else toFetch.add(bech32Id)
    }

    if (toFetch.isEmpty()) return result

    runCatching {
        val response = koiosHttp.post("${koiosBaseUrl(network)}/pool_info") {
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                putJsonArray("_pool_bech32_ids") { toFetch.forEach { add(it) } }
            })
        }
        val body: JsonArray = response.body()

        for (item in body) {
            val obj      = item.jsonObject
            val bech32Id = obj["pool_id_bech32"]?.jsonPrimitive?.contentOrNull ?: continue
            val name     = obj["meta_json"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull
            val power    = obj["voting_power"]?.jsonPrimitive?.longOrNull ?: 0L
            val info     = PoolInfo(name = name, votingPower = power)
            result[bech32Id] = info
            CardanoCache.poolInfo.put("${network.name}:$bech32Id", info)
        }
    }.onFailure { e ->
        logger.warn { "Koios pool_info fetch failed for $network: ${e.message}" }
    }

    return result
}

/**
 * Scan raw Ogmios governanceProposals JSON and collect all unique SPO pool IDs.
 * Ogmios returns pool IDs in bech32 format (pool1...).
 */
fun extractSPOPoolIds(raw: JsonElement): List<String> {
    val array: JsonArray = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["governanceProposals"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return emptyList()
        else          -> return emptyList()
    }
    val ids = mutableSetOf<String>()
    for (item in array) {
        val votes = item.jsonObject["votes"]?.jsonArray ?: continue
        for (vote in votes) {
            val issuer = vote.jsonObject["issuer"]?.jsonObject ?: continue
            if (issuer["role"]?.jsonPrimitive?.contentOrNull == "stakePoolOperator") {
                issuer["id"]?.jsonPrimitive?.contentOrNull?.let { ids.add(it) }
            }
        }
    }
    return ids.toList()
}
