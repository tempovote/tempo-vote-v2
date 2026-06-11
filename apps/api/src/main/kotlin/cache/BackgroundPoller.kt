package vote.tempo.cache

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.server.application.*
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.*
import vote.tempo.cardano.CCContext
import vote.tempo.cardano.GovernanceThresholds
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.parseCCContext
import vote.tempo.cardano.parseDRepDelegatorCounts
import vote.tempo.cardano.parseDRepStakeContext
import vote.tempo.cardano.parseGovernanceThresholds
import vote.tempo.cardano.extractSPOPoolIds
import vote.tempo.cardano.fetchPoolInfoBlockfrost
import vote.tempo.cardano.runPoolMetadataFetcher
import vote.tempo.cardano.credentialHexToDrepIdCip105
import vote.tempo.cardano.parseProposals
import vote.tempo.cardano.blockfrostProjectId
import vote.tempo.cardano.fetchDRepDelegatorsBlockfrost
import vote.tempo.db.ChainIndexDao
import vote.tempo.db.GovernanceActionDao

private val logger = KotlinLogging.logger("BackgroundPoller")

private const val POLL_INTERVAL_MS        = 5 * 60 * 1_000L    // 5 min — Ogmios state refresh
private const val QUERY_TIMEOUT_MS        = 420_000L            // 7 min cap — delegateRepresentatives alone takes ~2 min on mainnet (8 MB response)
private const val MAX_BACKOFF_MS          = 30 * 60 * 1_000L   // 30 minutes max backoff
private const val STARTUP_DELAY_MS        = 3_000L
private const val WHALE_POLL_STARTUP_MS   = 5 * 60 * 1_000L        // 5 min — allow Ogmios first poll to warm drepDelegatorCounts
private const val WHALE_POLL_INTERVAL_MS  = 2 * 60 * 60 * 1_000L   // 2 h — whale distribution changes slowly
private const val WHALE_TOP_DREPS         = 20                       // candidates per network
private const val WHALE_THRESHOLD         = 1_000_000_000_000L      // 1M ADA in lovelace
private const val POOL_STAKE_STARTUP_MS   = 10 * 60 * 1_000L        // 10 min — wait for govActions cache to warm
private const val POOL_STAKE_INTERVAL_MS  = 8 * 60 * 60 * 1_000L   // 8 h — live stake changes slowly

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
    // Delegator counts are extracted from the same getDelegateRepresentatives response —
    // no separate poll cycle needed.
    scope.launch {
        delay(STARTUP_DELAY_MS)
        logger.info { "BackgroundPoller first poll starting" }
        while (isActive) {
            pollAllNetworks()
            delay(POLL_INTERVAL_MS)
        }
    }

    // Pool metadata fetcher: fetches name/ticker from metadata URLs stored by VoteIndexer.
    val activeNetworks = buildList {
        if (System.getenv("OGMIOS_MAINNET_URL") != null) add("mainnet")
        if (System.getenv("OGMIOS_PREPROD_URL") != null) add("preprod")
    }
    if (activeNetworks.isNotEmpty()) {
        scope.launch { runPoolMetadataFetcher(activeNetworks) }
    }

    // Blockfrost whale delegator indexer: fetches all delegators for top DReps and stores
    // amounts in drep_delegator_stakes. Only runs if BLOCKFROST_{NETWORK}_PROJECT_ID is set.
    val blockfrostNetworks = listOf(Network.MAINNET, Network.PREPROD)
        .filter { blockfrostProjectId(it) != null }
    if (blockfrostNetworks.isNotEmpty()) {
        scope.launch {
            delay(WHALE_POLL_STARTUP_MS)
            while (isActive) {
                fetchAndIndexWhaleDelegators(blockfrostNetworks)
                delay(WHALE_POLL_INTERVAL_MS)
            }
        }
        logger.info { "Blockfrost whale indexer scheduled for ${blockfrostNetworks.map { it.name }} — every 2 h (startup delay 5 min)" }
    } else {
        logger.info { "Blockfrost whale indexer disabled — set BLOCKFROST_MAINNET_PROJECT_ID / BLOCKFROST_PREPROD_PROJECT_ID to enable" }
    }

    // Blockfrost pool stake indexer: fetches live_stake + name/ticker for SPO pools
    // that have voted on governance actions. Stores into idx_pool_metadata every 8 h.
    // Requires same Blockfrost project IDs — runs only if at least one key is configured.
    if (blockfrostNetworks.isNotEmpty()) {
        scope.launch {
            delay(POOL_STAKE_STARTUP_MS)
            while (isActive) {
                fetchAndIndexPoolStakes(blockfrostNetworks)
                delay(POOL_STAKE_INTERVAL_MS)
            }
        }
        logger.info { "Blockfrost pool stake indexer scheduled for ${blockfrostNetworks.map { it.name }} — every 8 h (startup delay 10 min)" }
    }

    logger.info { "BackgroundPoller scheduled — Ogmios state every 5 min (delegator counts inline), pool metadata fetch every 1 h" }
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

            // Delegator counts come directly from the same Ogmios response —
            // no VoteIndexer or Koios needed.
            val delegCounts = parseDRepDelegatorCounts(dreps)
            CardanoCache.drepDelegatorCounts.put(network.name, delegCounts)
            CardanoCache.leaderboard.invalidateAll()
            logger.info { "BackgroundPoller [$network] delegator counts refreshed: ${delegCounts.size} DReps" }

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
            // Pool info: local DB only (idx_pool_metadata populated by Blockfrost pool stake indexer).
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
        logger.debug { "BackgroundPoller [$network] refreshed drepList + govActions + delegatorCounts + DB sync" }
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
 * Build pool info map from local DB only — no external API calls at poll time.
 * Missing pools (not yet indexed by Blockfrost) return PoolInfo(name=null, votingPower=0L).
 * The Blockfrost pool stake indexer runs every 8 h and populates idx_pool_metadata.
 */
private suspend fun buildPoolInfoMap(
    poolIds: List<String>,
    network: Network,
): Map<String, vote.tempo.cardano.PoolInfo> {
    if (poolIds.isEmpty()) return emptyMap()
    return withContext(Dispatchers.IO) {
        ChainIndexDao.getPoolInfoMap(poolIds, network.name.lowercase())
    }
}

/**
 * Fetch live stake + name/ticker for every SPO pool that has voted on governance actions.
 * Called every 8 h by BackgroundPoller. Upserts into idx_pool_metadata so that
 * buildPoolInfoMap reads up-to-date voting_power without any Koios/Blockfrost call at
 * request time.
 */
private suspend fun fetchAndIndexPoolStakes(networks: List<Network>) {
    for (network in networks) {
        val raw = CardanoCache.govActions.getIfPresent(network.name)
        if (raw == null) {
            logger.debug { "Pool stake index [$network] skipped — govActions cache not yet warmed" }
            continue
        }

        val poolIds = extractSPOPoolIds(raw)
        if (poolIds.isEmpty()) {
            logger.debug { "Pool stake index [$network] — no SPO pools found in governance actions" }
            continue
        }

        var indexed = 0
        for (poolIdBech32 in poolIds) {
            val info = fetchPoolInfoBlockfrost(poolIdBech32, network) ?: continue
            withContext(Dispatchers.IO) {
                ChainIndexDao.upsertPoolFromBlockfrost(
                    network      = network.name.lowercase(),
                    poolIdBech32 = poolIdBech32,
                    poolIdHex    = info.poolIdHex,
                    name         = info.name,
                    ticker       = info.ticker,
                    votingPower  = info.liveStake,
                )
            }
            indexed++
        }

        if (indexed > 0) {
            logger.info { "Pool stake index [$network] upserted $indexed / ${poolIds.size} pools — voting_power refreshed" }
        }
    }
}

/**
 * Fetch all delegators for the top [WHALE_TOP_DREPS] DReps (by delegator count) from Blockfrost
 * and upsert into drep_delegator_stakes. Runs sequentially per DRep to avoid burst limits.
 * Invalidates whaleLeaders cache after each network completes so the next request reads fresh data.
 */
private suspend fun fetchAndIndexWhaleDelegators(networks: List<Network>) {
    for (network in networks) {
        val delegCounts = CardanoCache.drepDelegatorCounts.getIfPresent(network.name)
        if (delegCounts.isNullOrEmpty()) {
            logger.debug { "Whale index [$network] skipped — drepDelegatorCounts not yet warmed" }
            continue
        }

        val topDreps = delegCounts.entries
            .sortedByDescending { it.value }
            .take(WHALE_TOP_DREPS)

        var indexed = 0
        for ((credHex, delegatorCount) in topDreps) {
            val drepId = credentialHexToDrepIdCip105(credHex) ?: continue
            val delegators = fetchDRepDelegatorsBlockfrost(drepId, network)
            if (delegators.isEmpty()) {
                logger.debug { "Whale index [$network] $drepId — no delegators returned (rate-limited or no data)" }
                continue
            }
            withContext(Dispatchers.IO) {
                ChainIndexDao.upsertDRepDelegators(network.name.lowercase(), credHex, delegators)
            }
            val whaleCount = delegators.count { (_, amount) -> amount > WHALE_THRESHOLD }
            logger.debug { "Whale index [$network] $drepId: ${delegators.size} delegators upserted ($whaleCount whales, $delegatorCount total known)" }
            indexed++
        }

        if (indexed > 0) {
            CardanoCache.whaleLeaders.invalidateAll()
            logger.info { "Whale index [$network] refreshed $indexed / ${topDreps.size} DReps — whaleLeaders cache invalidated" }
        }
    }
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
