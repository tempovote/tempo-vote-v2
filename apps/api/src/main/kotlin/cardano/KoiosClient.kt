package vote.tempo.cardano

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import io.github.oshai.kotlinlogging.KotlinLogging
import vote.tempo.cache.CardanoCache

private val logger = KotlinLogging.logger("KoiosClient")

data class PoolInfo(
    val name: String?,
    val votingPower: Long,
)

private val koiosJson = Json { ignoreUnknownKeys = true }

// No ContentNegotiation — parse via bodyAsText() to avoid "SourceByteReadChannel" errors
// when Koios returns 429/5xx with non-JSON Content-Type.
// requestTimeout = 0 disables CIO's built-in socket-idle timeout so it doesn't race against
// coroutine withTimeout() wrappers — same fix applied to OgmiosStateQueries.
private val koiosHttp = HttpClient(CIO) {
    engine { requestTimeout = 0 }
}

private suspend fun HttpResponse.jsonArray(): JsonArray {
    val text = bodyAsText()
    if (!status.isSuccess()) throw Exception("HTTP ${status.value}: ${text.take(200)}")
    return koiosJson.parseToJsonElement(text).jsonArray
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
        val body: JsonArray = response.jsonArray()

        for (item in body) {
            val obj      = item.jsonObject
            val bech32Id = obj["pool_id_bech32"]?.jsonPrimitive?.contentOrNull ?: continue
            // meta_json may be JsonNull (no pool metadata) — cast safely to avoid IllegalArgumentException
            val name     = (obj["meta_json"] as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull
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
 * Fetch rationale URLs (CIP-100 meta_url) for all votes on a specific governance action.
 * Ogmios does not return per-vote anchor fields; Koios proposal_votes fills that gap.
 * Returns Map<voterKey, rationaleUrl> where voterKey is credential hex (DRep/CC) or bech32 pool ID (SPO).
 */
suspend fun fetchProposalVoteRationales(txHash: String, index: Int, network: Network): Map<String, String> {
    val cacheKey = "${network.name}:$txHash#$index"
    CardanoCache.proposalRationales.getIfPresent(cacheKey)?.let { return it }

    val govActionId = txHashToGovActionId(txHash, index)
    val result = mutableMapOf<String, String>()

    runCatching {
        var offset = 0
        val limit  = 1000
        while (true) {
            val response = koiosHttp.get("${koiosBaseUrl(network)}/proposal_votes") {
                parameter("_proposal_id", govActionId)
                parameter("limit",  limit)
                parameter("offset", offset)
            }
            val page: JsonArray = response.jsonArray()
            for (item in page) {
                val obj    = item.jsonObject
                val metaUrl = obj["meta_url"]?.jsonPrimitive?.contentOrNull ?: continue
                // voter_hex = credential hex (DRep/CC). Also index voter_id (bech32) for SPO pool1...
                obj["voter_hex"]?.jsonPrimitive?.contentOrNull?.let { result[it] = metaUrl }
                obj["voter_id"]?.jsonPrimitive?.contentOrNull?.let  { result[it] = metaUrl }
            }
            if (page.size < limit) break
            offset += limit
        }
    }.onFailure { e ->
        logger.warn { "Koios proposal_votes fetch failed for $txHash#$index [$network]: ${e.message}" }
    }

    CardanoCache.proposalRationales.put(cacheKey, result)
    return result
}

/**
 * Fetch rationale maps for all proposals in a raw Ogmios governanceProposals response.
 * Returns Map<"txHash#index", Map<voterKey, rationaleUrl>>.
 */
suspend fun buildRationalesMap(raw: JsonElement, network: Network): Map<String, Map<String, String>> {
    val array: JsonArray = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["governanceProposals"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return emptyMap()
        else          -> return emptyMap()
    }
    val result = mutableMapOf<String, Map<String, String>>()
    for (item in array) {
        val proposal = item.jsonObject["proposal"]?.jsonObject ?: continue
        val txHash   = proposal["transaction"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: continue
        val index    = proposal["index"]?.jsonPrimitive?.int ?: 0
        val rationales = fetchProposalVoteRationales(txHash, index, network)
        if (rationales.isNotEmpty()) result["$txHash#$index"] = rationales
    }
    return result
}

data class DRepKoiosStats(
    val liveVotingPower: Long,
    val delegatorCount: Int,
    val votedCount: Int,
    val totalGaCount: Int,
)

/**
 * Fetch DRep live stats from Koios in 4 calls:
 *  1. drep_info       → liveVotingPower (amount field)
 *  2. drep_delegators → delegatorCount via Content-Range header (limit=0, count=exact)
 *  3. drep_votes      → votedCount (paginated, limit=1000)
 *  4. proposal_list   → totalGaCount via Content-Range header (accurate denominator for voted%)
 *
 * Using proposal_list for the denominator avoids inflated voted% when our DB snapshot
 * only covers a fraction of the chain's historical governance actions.
 * Returns null on total failure so callers can fall back gracefully.
 */
// 60 s is enough for the 4 sequential Koios calls (drep_info, drep_delegators,
// drep_votes pagination, proposal_list). If Koios is under load we'd rather
// time out cleanly than hang the HTTP request thread indefinitely.
private const val DREP_STATS_TIMEOUT_MS = 60_000L

suspend fun fetchDRepKoiosStats(drepId: String, network: Network): DRepKoiosStats? {
    val base = koiosBaseUrl(network)
    return runCatching {
      withTimeout(DREP_STATS_TIMEOUT_MS) {
        // ── 1. live voting power from drep_info ───────────────────────────────
        val infoResp = koiosHttp.get("$base/drep_info") {
            parameter("_drep_ids", "{$drepId}")
        }
        val infoBody: JsonArray = infoResp.jsonArray()
        val liveVotingPower = infoBody.firstOrNull()?.jsonObject
            ?.get("amount")?.jsonPrimitive?.longOrNull ?: 0L

        // ── 2. delegator count via Content-Range header (zero data rows) ──────
        val delegResp = koiosHttp.get("$base/drep_delegators") {
            parameter("_drep_id", drepId)
            parameter("limit", 0)
            header("Prefer", "count=exact")
        }
        val delegatorCount = delegResp.headers["Content-Range"]
            ?.substringAfterLast("/")?.toIntOrNull() ?: 0

        // ── 3. voted count from drep_votes (paginate until done) ──────────────
        var votedCount = 0
        var offset = 0
        val limit = 1000
        while (true) {
            val votesResp = koiosHttp.get("$base/drep_votes") {
                parameter("_drep_id", drepId)
                parameter("limit",  limit)
                parameter("offset", offset)
            }
            val page: JsonArray = votesResp.jsonArray()
            votedCount += page.size
            if (page.size < limit) break
            offset += limit
        }

        // ── 4. total GA count from proposal_list (accurate chain-wide denominator) ──
        val proposalResp = koiosHttp.get("$base/proposal_list") {
            parameter("limit", 0)
            header("Prefer", "count=exact")
        }
        val totalGaCount = proposalResp.headers["Content-Range"]
            ?.substringAfterLast("/")?.toIntOrNull() ?: votedCount

        // totalGaCount comes from proposal_list (active only); drep_votes includes expired/ratified.
        // Use max so voted% never exceeds 100% due to the active-only window.
        DRepKoiosStats(liveVotingPower, delegatorCount, votedCount, maxOf(totalGaCount, votedCount))
      }
    }.onFailure { e ->
        logger.warn { "Koios DRep stats fetch failed for $drepId [$network]: ${e.message}" }
    }.getOrNull()
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
