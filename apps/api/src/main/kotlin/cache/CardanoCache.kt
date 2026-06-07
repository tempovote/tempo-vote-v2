package vote.tempo.cache

import com.github.benmanes.caffeine.cache.Caffeine
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
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

    /** All governance actions — refreshed by BackgroundPoller. */
    val govActions = Caffeine.newBuilder()
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build<String, JsonElement>()

    /** Protocol parameters — changes only at epoch boundary. */
    val protocolParams = Caffeine.newBuilder()
        .expireAfterWrite(24, TimeUnit.HOURS)
        .build<String, JsonElement>()

    /** Constitutional committee members — changes only on updateCommittee actions. */
    val ccCommittee = Caffeine.newBuilder()
        .expireAfterWrite(30, TimeUnit.MINUTES)
        .build<String, JsonElement>()

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
}
