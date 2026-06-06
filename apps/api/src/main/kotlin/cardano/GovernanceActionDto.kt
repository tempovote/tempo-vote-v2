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
    val drepVotes: VoteCounts,
    val spoVotes: VoteCounts,
    val ccVotes: VoteCounts,
)

@Serializable
data class VoteCounts(
    val yes: Int,
    val no: Int,
    val abstain: Int,
) {
    val total: Int get() = yes + no + abstain
}

/** Map one Ogmios `governanceProposals` item → GovernanceActionDto. Returns null on parse error. */
fun mapOgmiosProposal(obj: JsonObject): GovernanceActionDto? = runCatching {
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

    val drepVotes = aggregateVotes(votes, "delegateRepresentative")
    val spoVotes = aggregateVotes(votes, "stakePoolOperator")
    val ccVotes = aggregateVotes(votes, "constitutionalCommittee")

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

private fun actionTypeLabel(ogmiosType: String): String = when (ogmiosType) {
    "treasuryWithdrawals"      -> "Treasury Withdrawals"
    "protocolParametersUpdate" -> "Protocol Parameter Change"
    "hardForkInitiation"       -> "Hard Fork Initiation"
    "noConfidence"             -> "No Confidence"
    "updateCommittee"          -> "Update Committee"
    "newConstitution"          -> "New Constitution"
    "infoAction"               -> "Info Action"
    else                       -> ogmiosType
}
