package vote.tempo.cardano

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

@Serializable
data class GovernanceActionDto(
    val txHash: String,
    val index: Int,
    val type: String,           // display label, e.g. "Treasury Withdrawals"
    val actionType: String,     // raw Ogmios type, e.g. "treasuryWithdrawals"
    val anchorUrl: String?,     // ipfs:// or https:// — convert for display on FE
    val anchorHash: String?,
    val expiresEpoch: Int,
    val deposit: Long,          // lovelace
    val drepVotes: DRepVoteStats,
    val spoVotes: VoteCounts,
    val ccVotes: VoteCounts,
)

/**
 * DRep vote totals with ADA voting power — implements the GovTool ratification formula.
 *
 * Ratification check (denominator = totalActiveDRepStake, abstain excluded):
 *   Non-NoConfidence: yesTotal = yesVotingPower,           noTotal = noVotingPower + autoNoConfidenceStake
 *   NoConfidence:     yesTotal = yesVotingPower + autoNoConfidenceStake, noTotal = noVotingPower
 *
 * Ref: https://docs.gov.tools/cardano-govtool/faqs/how-governance-action-vote-totals-are-calculated-in-govtool
 */
@Serializable
data class DRepVoteStats(
    val yes: Int,
    val no: Int,
    val abstain: Int,
    /** Lovelace staked by DReps that voted yes (active DReps only, excludes predefined). */
    val yesVotingPower: Long,
    val noVotingPower: Long,
    val abstainVotingPower: Long,
    /** Stake delegated to the always-abstain predefined DRep. Added to abstain total, NOT in denominator. */
    val autoAbstainStake: Long,
    /** Stake delegated to the always-no-confidence predefined DRep. Counted as No (or Yes for NoConfidence). IS in denominator. */
    val autoNoConfidenceStake: Long,
    /** Denominator: sum of all active registered DRep stakes + autoNoConfidenceStake (excludes autoAbstain). */
    val totalActiveDRepStake: Long,
)

@Serializable
data class VoteCounts(
    val yes: Int,
    val no: Int,
    val abstain: Int,
) {
    val total: Int get() = yes + no + abstain
}

/**
 * Parsed stake context from `queryLedgerState/delegateRepresentatives`.
 * Built once per cache refresh and passed into proposal mapping.
 */
data class DRepStakeContext(
    /** credentialHex (56-char) → lovelace for all registered active DReps. */
    val stakeMap: Map<String, Long>,
    val autoAbstainStake: Long,
    val autoNoConfidenceStake: Long,
    /** = Σ(stakeMap.values) + autoNoConfidenceStake — the ratification denominator. */
    val totalActiveDRepStake: Long,
) {
    companion object {
        val EMPTY = DRepStakeContext(emptyMap(), 0L, 0L, 0L)
    }
}

/**
 * Parse DRep stake distribution from the `delegateRepresentatives` Ogmios response.
 * Handles both JsonArray (direct) and JsonObject wrapper shapes.
 */
fun parseDRepStakeContext(raw: JsonElement): DRepStakeContext {
    val entries: JsonArray = when (raw) {
        is JsonArray  -> raw
        is JsonObject -> raw["delegateRepresentatives"]?.jsonArray
            ?: raw.values.firstOrNull()?.let { if (it is JsonArray) it else null }
            ?: return DRepStakeContext.EMPTY
        else -> return DRepStakeContext.EMPTY
    }

    val stakeMap = mutableMapOf<String, Long>()
    var autoAbstainStake = 0L
    var autoNoConfidenceStake = 0L

    for (entry in entries) {
        val obj = entry.jsonObject
        val type  = obj["type"]?.jsonPrimitive?.contentOrNull ?: continue
        val stake = obj["stake"]?.jsonObject?.let { extractLovelace(it) } ?: 0L

        when (type) {
            "abstain"      -> autoAbstainStake = stake
            "noConfidence" -> autoNoConfidenceStake = stake
            "registered"   -> {
                val id = obj["id"]?.jsonPrimitive?.contentOrNull ?: continue
                stakeMap[id] = stake
            }
        }
    }

    val totalActiveDRepStake = stakeMap.values.sumOf { it } + autoNoConfidenceStake

    return DRepStakeContext(stakeMap, autoAbstainStake, autoNoConfidenceStake, totalActiveDRepStake)
}

/** Map one Ogmios `governanceProposals` item → GovernanceActionDto. Returns null on parse error. */
fun mapOgmiosProposal(obj: JsonObject, stakeCtx: DRepStakeContext = DRepStakeContext.EMPTY): GovernanceActionDto? = runCatching {
    val proposal = obj["proposal"]?.jsonObject ?: return null
    val txHash = proposal["transaction"]?.jsonObject?.get("id")?.jsonPrimitive?.content ?: return null
    val index = proposal["index"]?.jsonPrimitive?.int ?: 0

    val action = obj["action"]?.jsonObject ?: return null
    val actionType = action["type"]?.jsonPrimitive?.contentOrNull ?: "unknown"
    val type = actionTypeLabel(actionType)

    val metadata = obj["metadata"]?.jsonObject
    val anchorUrl = metadata?.get("url")?.jsonPrimitive?.contentOrNull
    val anchorHash = metadata?.get("hash")?.jsonPrimitive?.contentOrNull

    val expiresEpoch = obj["until"]?.jsonObject?.get("epoch")?.jsonPrimitive?.int ?: 0

    val deposit = obj["deposit"]?.jsonObject
        ?.let { extractLovelace(it) } ?: 0L

    // votes is an array of { issuer: { role, from, id }, vote: "yes"|"no"|"abstain" }
    val votes = obj["votes"]?.jsonArray ?: JsonArray(emptyList())

    val drepVotes = aggregateDRepVotes(votes, stakeCtx)
    val spoVotes  = aggregateVotes(votes, "stakePoolOperator")
    val ccVotes   = aggregateVotes(votes, "constitutionalCommittee")

    GovernanceActionDto(
        txHash = txHash,
        index = index,
        type = type,
        actionType = actionType,
        anchorUrl = anchorUrl,
        anchorHash = anchorHash,
        expiresEpoch = expiresEpoch,
        deposit = deposit,
        drepVotes = drepVotes,
        spoVotes = spoVotes,
        ccVotes = ccVotes,
    )
}.getOrNull()

private fun aggregateDRepVotes(votes: JsonArray, stakeCtx: DRepStakeContext): DRepVoteStats {
    var yes = 0; var no = 0; var abstain = 0
    var yesPower = 0L; var noPower = 0L; var abstainPower = 0L

    for (entry in votes) {
        val obj  = entry.jsonObject
        val role = obj["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.contentOrNull
        if (role != "delegateRepresentative") continue
        val id    = obj["issuer"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: continue
        val stake = stakeCtx.stakeMap[id] ?: 0L

        when (obj["vote"]?.jsonPrimitive?.contentOrNull) {
            "yes"     -> { yes++;     yesPower    += stake }
            "no"      -> { no++;      noPower     += stake }
            "abstain" -> { abstain++; abstainPower += stake }
        }
    }

    return DRepVoteStats(
        yes = yes,
        no = no,
        abstain = abstain,
        yesVotingPower = yesPower,
        noVotingPower = noPower,
        abstainVotingPower = abstainPower,
        autoAbstainStake = stakeCtx.autoAbstainStake,
        autoNoConfidenceStake = stakeCtx.autoNoConfidenceStake,
        totalActiveDRepStake = stakeCtx.totalActiveDRepStake,
    )
}

private fun aggregateVotes(votes: JsonArray, role: String): VoteCounts {
    var yes = 0; var no = 0; var abstain = 0
    for (entry in votes) {
        val obj = entry.jsonObject
        val issuerRole = obj["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.contentOrNull
        if (issuerRole != role) continue
        when (obj["vote"]?.jsonPrimitive?.contentOrNull) {
            "yes"     -> yes++
            "no"      -> no++
            "abstain" -> abstain++
        }
    }
    return VoteCounts(yes, no, abstain)
}

/** Extract lovelace amount — handles { "ada": { "lovelace": N } } and { "lovelace": N } */
fun extractLovelace(value: JsonObject): Long {
    return value["ada"]?.jsonObject?.get("lovelace")?.jsonPrimitive?.long
        ?: value["lovelace"]?.jsonPrimitive?.long
        ?: 0L
}

internal fun actionTypeLabel(ogmiosType: String): String = when (ogmiosType) {
    "treasuryWithdrawals"      -> "Treasury Withdrawals"
    "protocolParametersUpdate" -> "Protocol Parameter Change"
    "hardForkInitiation"       -> "Hard Fork Initiation"
    "noConfidence"             -> "No Confidence"
    "updateCommittee"          -> "Update Committee"
    "newConstitution"          -> "New Constitution"
    "infoAction"               -> "Info Action"
    else                       -> ogmiosType
}
