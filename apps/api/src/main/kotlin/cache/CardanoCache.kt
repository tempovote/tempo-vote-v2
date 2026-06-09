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
     * TTL matches BackgroundPoller interval so stale data is replaced each poll cycle.
     */
    val drepDelegatorCounts = Caffeine.newBuilder()
        .expireAfterWrite(20, TimeUnit.MINUTES)
        .build<String, Map<String, Int>>()  // key: network.name

    /**
     * Full leaderboard result — computed once, cached 15 min.
     * Prevents re-computing and re-fetching Koios on every page load.
     */
    val leaderboard = Caffeine.newBuilder()
        .expireAfterWrite(15, TimeUnit.MINUTES)
        .build<String, JsonElement>()   // key: "NETWORK:limit"
}
