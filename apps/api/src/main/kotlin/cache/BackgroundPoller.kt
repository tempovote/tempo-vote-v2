package vote.tempo.cache

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.server.application.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import vote.tempo.cardano.CCContext
import vote.tempo.cardano.GovernanceThresholds
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.parseCCContext
import vote.tempo.cardano.parseDRepStakeContext
import vote.tempo.cardano.parseGovernanceThresholds
import vote.tempo.cardano.extractSPOPoolIds
import vote.tempo.cardano.fetchPoolInfo
import vote.tempo.cardano.credentialHexToDrepIdCip105
import vote.tempo.cardano.parseProposals
import vote.tempo.db.ChainIndexDao
import vote.tempo.db.GovernanceActionDao

private val logger = KotlinLogging.logger("BackgroundPoller")

private const val POLL_INTERVAL_MS        = 5 * 60 * 1_000L   // 5 min — Ogmios state refresh
private const val QUERY_TIMEOUT_MS        = 420_000L           // 7 min cap — delegateRepresentatives alone takes ~2 min on mainnet (8 MB response)
private const val MAX_BACKOFF_MS          = 30 * 60 * 1_000L  // 30 minutes max backoff
private const val STARTUP_DELAY_MS        = 3_000L
// Delegator counts run on a separate, slower cycle: wait for first Ogmios poll to populate
// stakeMap, then refresh every 15 min sequentially. 200 DReps × ~200 ms/call ≈ 40 s total.
// 5-min startup delay (vs 3 min for Ogmios) ensures getDelegateRepresentatives (~2 min on mainnet)
// completes before the first delegator fetch attempt — avoids a guaranteed skip on cold start.
private const val DELEGATOR_POLL_DELAY_MS    = 5 * 60 * 1_000L  // wait 5 min after startup
private const val DELEGATOR_POLL_INTERVAL_MS = 15 * 60 * 1_000L // 15 min cadence

// Per-network state for exponential backoff
private val consecutiveFailures = mutableMapOf<Network, Int>()
private val nextPollTime        = mutableMapOf<Network, Long>()

fun Application.startBackgroundPoller() {
    val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    monitor.subscribe(ApplicationStopped) {
        logger.info { "BackgroundPoller stopping" }
        scope.cancel()
    }

    // Main poll: Ogmios state (DRep list, gov actions, CC, epoch, protocol params)
    scope.launch {
        delay(STARTUP_DELAY_MS)
        logger.info { "BackgroundPoller first poll starting" }
        while (isActive) {
            pollAllNetworks()
            delay(POLL_INTERVAL_MS)
        }
    }

    // Delegator count poll: reads local chain index — fast DB query, no Koios rate limit.
    scope.launch {
        delay(DELEGATOR_POLL_DELAY_MS)
        while (isActive) {
            pollDelegatorCounts()
            delay(DELEGATOR_POLL_INTERVAL_MS)
        }
    }

    logger.info { "BackgroundPoller scheduled — Ogmios state every 5 min, delegator counts every 15 min (local index)" }
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

            // Current epoch is needed for status computation and disappeared-proposal detection.
            val epoch = q.getCurrentEpoch()
            CardanoCache.currentEpoch.put(network.name, epoch)

            // Fetch CC state here so hotToName is always available when parsing proposals.
            // Without this, parsedGovActions would be cached with CCContext.EMPTY after restart
            // (before any GA detail route triggers getOrFetchCCContext).
            val ccRaw = runCatching { q.getConstitutionalCommittee() }.getOrNull()
            if (ccRaw != null) CardanoCache.ccCommittee.put(network.name, ccRaw)

            val stakeCtx   = parseDRepStakeContext(dreps)
            val ccCtx      = ccRaw
                ?.let { runCatching { parseCCContext(it) }.getOrDefault(CCContext.EMPTY) }
                ?: CCContext.EMPTY
            val thresholds = CardanoCache.protocolParams.getIfPresent(network.name)
                ?.let { runCatching { parseGovernanceThresholds(it.jsonObject) }.getOrDefault(GovernanceThresholds.DEFAULT) }
                ?: GovernanceThresholds.DEFAULT

            // Parse proposals and pre-warm the parsed cache so the first API request after
            // a poll cycle is served instantly without re-parsing the raw JSON.
            // Pool info: local index first, Koios fallback for unknown pools.
            val spoPoolIds    = extractSPOPoolIds(gas)
            val poolInfoMap   = buildPoolInfoMap(spoPoolIds, network)
            // Rationale URLs: local chain index (VoteIndexer populated drep_votes.anchor_url).
            val rationalesMap = buildLocalRationalesMap(gas, network)
            val parsed = parseProposals(gas, stakeCtx, ccCtx, thresholds, epoch, poolInfoMap, rationalesMap)
            CardanoCache.parsedGovActions.put(network.name, parsed)

            // Persist snapshot to DB — marks disappeared proposals with final status
            // so the list endpoint can serve a complete history (expired / enacted / dropped).
            GovernanceActionDao.sync(parsed, network.name.lowercase(), epoch)
        }
        // Success — reset backoff
        consecutiveFailures.remove(network)
        nextPollTime.remove(network)
        logger.debug { "BackgroundPoller [$network] refreshed drepList + govActions + DB sync" }
    }.onFailure { e ->
        val failures = (consecutiveFailures[network] ?: 0) + 1
        consecutiveFailures[network] = failures
        // Exponential backoff: 5m, 10m, 20m, capped at 30m
        val backoff = minOf(POLL_INTERVAL_MS * (1L shl (failures - 1).coerceAtMost(3)), MAX_BACKOFF_MS)
        nextPollTime[network] = System.currentTimeMillis() + backoff
        logger.warn { "BackgroundPoller [$network] failed ($failures consecutive): ${e.message} — next retry in ${backoff / 60_000}m" }
    }
}

/**
 * Delegator counts from local chain index (replaces Koios sequential polling).
 * Reads idx_delegation_vote populated by VoteIndexer — no rate limits, instant query.
 */
private suspend fun pollDelegatorCounts() {
    if (System.getenv("OGMIOS_MAINNET_URL") != null) pollDelegatorCountsForNetwork(Network.MAINNET)
    if (System.getenv("OGMIOS_PREPROD_URL") != null) pollDelegatorCountsForNetwork(Network.PREPROD)
}

private suspend fun pollDelegatorCountsForNetwork(network: Network) {
    val stakeMap = CardanoCache.drepList.getIfPresent(network.name)
        ?.let { runCatching { parseDRepStakeContext(it).stakeMap }.getOrNull() }
        ?: run {
            logger.info { "DelegatorPoller [$network] skipped — drepList not yet cached" }
            return
        }

    val top200    = stakeMap.entries.sortedByDescending { it.value }.take(200)
    val credHexes = top200.map { it.key }

    // Batch query: single DB call for all 200 DReps (no rate limiting needed)
    val counts = withContext(kotlinx.coroutines.Dispatchers.IO) {
        ChainIndexDao.getDelegatorCounts(credHexes, network.name.lowercase())
    }

    CardanoCache.drepDelegatorCounts.put(network.name, counts)
    CardanoCache.leaderboard.invalidateAll()
    logger.info { "DelegatorPoller [$network] refreshed delegator counts for ${counts.size} DReps from local index" }
}

/**
 * Build pool info map from local index first; fall back to Koios for pools not yet indexed.
 */
private suspend fun buildPoolInfoMap(
    poolIds: List<String>,
    network: Network,
): Map<String, vote.tempo.cardano.PoolInfo> {
    if (poolIds.isEmpty()) return emptyMap()
    val result = mutableMapOf<String, vote.tempo.cardano.PoolInfo>()
    val missing = mutableListOf<String>()

    for (bech32Id in poolIds) {
        val local = withContext(Dispatchers.IO) {
            ChainIndexDao.getPoolInfo(bech32Id, network.name.lowercase())
        }
        if (local != null) {
            result[bech32Id] = vote.tempo.cardano.PoolInfo(name = local.first, votingPower = 0L)
        } else {
            missing.add(bech32Id)
        }
    }

    // Fall back to Koios for pools not yet in local index
    if (missing.isNotEmpty()) {
        result.putAll(fetchPoolInfo(missing, network))
    }

    return result
}

/**
 * Build rationale URL map from local chain index (drep_votes.anchor_url).
 * Extracts proposal IDs from raw Ogmios govActions JSON and queries local DB.
 */
private suspend fun buildLocalRationalesMap(
    raw: JsonElement,
    network: Network,
): Map<String, Map<String, String>> {
    val array: JsonArray = when (raw) {
        is JsonArray  -> raw
        is JsonObject ->
            raw["governanceProposals"]?.jsonArray
                ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
                ?: return emptyMap()
        else -> return emptyMap()
    }

    val proposals = array.mapNotNull { item ->
        val proposal = item.jsonObject["proposal"]?.jsonObject ?: return@mapNotNull null
        val txHash   = proposal["transaction"]?.jsonObject?.get("id")
            ?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
        val index    = proposal["index"]?.jsonPrimitive?.intOrNull ?: 0
        txHash to index
    }

    return withContext(Dispatchers.IO) {
        ChainIndexDao.buildRationalesMap(proposals, network.name.lowercase())
    }
}
