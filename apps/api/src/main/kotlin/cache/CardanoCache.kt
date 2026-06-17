package vote.tempo.cache

import com.github.benmanes.caffeine.cache.Caffeine
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import vote.tempo.cardano.GovernanceActionDto
import vote.tempo.cardano.PoolInfo
import java.util.concurrent.TimeUnit

/**
 * In-memory Cardano state cache backed by Caffeine.
 *
 * Two layers:
 *  - Global data (DRep list, governance actions, protocol params): pre-warmed by
 *    BackgroundPoller every 5 minutes. Requests are served from memory instantly.
 *  - Per-entity data (DRep info, stake delegation): populated on first request,
 *    then served from cache until TTL expires.
 *
 * Key conventions:
 *  - Global:     network.name            ("PREPROD" | "MAINNET")
 *  - Per-entity: "NETWORK:identifier"    ("PREPROD:stake1xyz", "MAINNET:credHex")
 */
object CardanoCache {

    // ── Global data ───────────────────────────────────────────────────────────

    /** Full list of registered DReps — refreshed by BackgroundPoller. */
    val drepList = Caffeine.newBuilder()
        .expireAfterWrite(10, TimeUnit.MINUTES)
        .build<String, JsonElement>()

    /** All governance actions (raw JSON) — refreshed by BackgroundPoller. */
    val govActions = Caffeine.newBuilder()
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build<String, JsonElement>()

    /**
     * Parsed + status-computed governance proposals — derived from govActions + context caches.
     * Invalidated by BackgroundPoller whenever govActions raw data is refreshed, so the parsed
     * list is never served beyond one polling cycle behind the raw data.
     */
    val parsedGovActions = Caffeine.newBuilder()
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build<String, List<GovernanceActionDto>>()

    /** Protocol parameters — changes only at epoch boundary. */
    val protocolParams = Caffeine.newBuilder()
        .expireAfterWrite(24, TimeUnit.HOURS)
        .build<String, JsonElement>()

    /** Constitutional committee members — changes only on updateCommittee actions. */
    val ccCommittee = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build<String, JsonElement>()

    /** Current epoch per network — TTL 30 min (epoch ≥ 1 day on all networks). */
    val currentEpoch = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build<String, Int>()

    // ── Per-entity data ───────────────────────────────────────────────────────

    /**
     * DRep info by credential hex — populated on /dreps/{id} requests.
     * Includes isRegistered, name, anchorUrl.
     * Long TTL: DRep metadata changes very rarely.
     */
    val drepInfo = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .maximumSize(2_000)
        .build<String, JsonObject>()    // key: "NETWORK:credentialHex"

    /**
     * Stake delegation per address — populated on /stake/{addr}/delegation.
     * Short TTL: user may re-delegate at any time.
     */
    val stakeDeleg = Caffeine.newBuilder()
        .expireAfterWrite(60, TimeUnit.SECONDS)
        .maximumSize(50_000)
        .build<String, JsonElement>()   // key: "NETWORK:stakeAddress"

    /**
     * Pool metadata (name, voting_power) fetched from Koios.
     * Long TTL: pool names rarely change.
     */
    val poolInfo = Caffeine.newBuilder()
        .expireAfterWrite(1, TimeUnit.HOURS)
        .maximumSize(10_000)
        .build<String, PoolInfo>()      // key: "NETWORK:bech32PoolId" (pool1...)

    /**
     * Per-proposal vote rationale URLs fetched from Koios proposal_votes.
     * Long TTL: rationale anchors are immutable once submitted.
     * Inner map key: credentialHex (DRep/CC) or bech32 pool ID (SPO) → rationale URL.
     */
    val proposalRationales = Caffeine.newBuilder()
        .expireAfterWrite(24, TimeUnit.HOURS)
        .maximumSize(500)
        .build<String, Map<String, String>>()  // key: "NETWORK:txHash#index"

    /**
     * DRep activity stats fetched from Koios (delegatorCount, liveVotingPower, votedCount).
     * TTL 15 min: delegators and votes change at most a few times per day.
     */
    val drepStats = Caffeine.newBuilder()
        .expireAfterWrite(15, TimeUnit.MINUTES)
        .maximumSize(2_000)
        .build<String, kotlinx.serialization.json.JsonObject>()  // key: "NETWORK:credentialHex"

    /**
     * Delegator counts per network, pre-warmed by BackgroundPoller for the top ~200 DReps.
     * Key: credentialHex → delegatorCount. Populated sequentially to avoid Koios burst limit.
     * TTL 30 min: leaderboard result is cached 1 h, so source data should outlive it.
     */
    val drepDelegatorCounts = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build<String, Map<String, Int>>()  // key: network.name

    /**
     * Full leaderboard result — computed once, cached 1 h.
     * Data is for reference only; freshness within an hour is acceptable.
     */
    val leaderboard = Caffeine.newBuilder()
        .expireAfterWrite(1, TimeUnit.HOURS)
        .build<String, JsonElement>()   // key: "NETWORK:limit:sortBy"

    /**
     * Whale delegator leaderboard — top DReps by count of delegators with stake > 1M ADA.
     * Computed from Koios drep_delegators (sorted amount desc, early-exit at threshold).
     * Long TTL: whale distribution changes very slowly, computation is Koios-intensive.
     */
    val whaleLeaders = Caffeine.newBuilder()
        .expireAfterWrite(6, TimeUnit.HOURS)
        .build<String, JsonElement>()   // key: "NETWORK:limit"

    /**
     * Cardano DApp ranking snapshot (DefiLlama), refreshed in DB by BackgroundPoller every 2 h.
     * In-memory layer in front of the DB read for GET /dapp-ranking. Single key "cardano".
     */
    val dappRanking = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build<String, JsonElement>()   // key: "cardano"

    /**
     * VP (stake) map per network — credHex → lovelace. Written each main poll cycle so the
     * whale indexer (2 h schedule) can select candidates by VP in addition to delegator count.
     */
    val drepStakeMap = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build<String, Map<String, Long>>()  // key: network.name

    /**
     * VP-change leaderboard — top DReps by |delta| between current epoch and previous epoch.
     * Computed from drep_vp_snapshots table. TTL 10 min (matches BackgroundPoller interval).
     * Cache is keyed by "NETWORK:limit" — invalidate on epoch change if needed.
     */
    val vpChangeLeaderboard = Caffeine.newBuilder()
        .expireAfterWrite(10, TimeUnit.MINUTES)
        .build<String, JsonElement>()   // key: "NETWORK:limit"

    /**
     * ADA Handle (default_handle) per DRep credential — resolved via api.handle.me.
     * Stored as empty string when the DRep has no handle (avoids repeated re-fetch on miss).
     * Long TTL: handle ownership changes very infrequently.
     */
    val adaHandles = Caffeine.newBuilder()
        .expireAfterWrite(1, TimeUnit.HOURS)
        .maximumSize(2_000)
        .build<String, String>()    // key: "NETWORK:credentialHex", value: handle or "" if none
}
