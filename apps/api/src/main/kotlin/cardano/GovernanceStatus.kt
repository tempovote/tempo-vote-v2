package vote.tempo.cardano

import kotlinx.serialization.json.*

// ── Governance voting thresholds ──────────────────────────────────────────────

/**
 * Parsed governance voting thresholds from `queryLedgerState/protocolParameters`.
 * Ogmios returns fraction strings ("67/100", "3/5") under the keys
 * `delegateRepresentativeVotingThresholds` and `stakePoolVotingThresholds`.
 *
 * All values are 0.0–1.0 doubles. Defaults match the Conway mainnet genesis values.
 */
data class GovernanceThresholds(
    // DRep thresholds
    val drepNoConfidence:           Double = 0.67,
    val drepCommitteeNormal:        Double = 0.67,
    val drepCommitteeNoConfidence:  Double = 0.60,
    val drepConstitution:           Double = 0.75,
    val drepHardFork:               Double = 0.60,
    val drepPpNetwork:              Double = 0.67,
    val drepPpEconomic:             Double = 0.67,
    val drepPpTechnical:            Double = 0.67,
    val drepPpGovernance:           Double = 0.75,
    val drepTreasury:               Double = 0.67,
    // SPO thresholds (count-based approximation — real check uses total registered pools)
    val poolNoConfidence:           Double = 0.51,
    val poolCommitteeNormal:        Double = 0.51,
    val poolHardFork:               Double = 0.51,
) {
    companion object {
        val DEFAULT = GovernanceThresholds()
    }
}

/**
 * Parse governance thresholds from the raw Ogmios protocolParameters JSON.
 * Falls back to `GovernanceThresholds.DEFAULT` values when a field is absent.
 */
fun parseGovernanceThresholds(raw: JsonObject): GovernanceThresholds {
    // "67/100" → 0.67,  "3/5" → 0.6,  "0.75" → 0.75
    fun String?.fraction(): Double {
        if (isNullOrBlank()) return 0.0
        val slash = indexOf('/')
        return if (slash >= 0) {
            val n = substring(0, slash).trim().toDoubleOrNull() ?: return 0.0
            val d = substring(slash + 1).trim().toDoubleOrNull()?.takeIf { it != 0.0 } ?: return 0.0
            n / d
        } else toDoubleOrNull() ?: 0.0
    }

    fun JsonObject?.str(key: String) = this?.get(key)?.jsonPrimitive?.contentOrNull
    fun JsonObject?.sub(key: String) = this?.get(key) as? JsonObject
    fun Double.orDefault(default: Double) = if (this > 0) this else default

    val drep   = raw.sub("delegateRepresentativeVotingThresholds")
    val pool   = raw.sub("stakePoolVotingThresholds")
    val drepCC = drep.sub("constitutionalCommittee")
    val poolCC = pool.sub("constitutionalCommittee")
    val drepPp = drep.sub("protocolParametersUpdate")

    return GovernanceThresholds(
        drepNoConfidence          = drep.str("noConfidence")             .fraction().orDefault(0.67),
        drepCommitteeNormal       = drepCC.str("default")                .fraction().orDefault(0.67),
        drepCommitteeNoConfidence = drepCC.str("stateOfNoConfidence")    .fraction().orDefault(0.60),
        drepConstitution          = drep.str("constitution")             .fraction().orDefault(0.75),
        drepHardFork              = drep.str("hardForkInitiation")       .fraction().orDefault(0.60),
        drepPpNetwork             = drepPp.str("network")               .fraction().orDefault(0.67),
        drepPpEconomic            = drepPp.str("economic")              .fraction().orDefault(0.67),
        drepPpTechnical           = drepPp.str("technical")             .fraction().orDefault(0.67),
        drepPpGovernance          = drepPp.str("governance")            .fraction().orDefault(0.75),
        drepTreasury              = drep.str("treasuryWithdrawals")      .fraction().orDefault(0.67),
        poolNoConfidence          = pool.str("noConfidence")             .fraction().orDefault(0.51),
        poolCommitteeNormal       = poolCC.str("default")                .fraction().orDefault(0.51),
        poolHardFork              = pool.str("hardForkInitiation")       .fraction().orDefault(0.51),
    )
}

// ── Status computation ────────────────────────────────────────────────────────

/**
 * Derive a GA status string from on-chain vote data, epoch state, and thresholds.
 *
 * Priority order (matches CIP-1694 lifecycle):
 *   ratified > expired > active
 *
 * Note: `enacted` and `dropped` cannot be computed from Ogmios — those proposals
 * are removed from the ledger state and will not appear in the proposals list.
 *
 * `infoAction` never produces a meaningful "ratified" state; it is active or expired.
 *
 * SPO ratification uses votes-cast as denominator (approximation — the spec
 * requires total registered pools, which is not available in governance queries).
 */
fun computeGAStatus(
    actionType: String,
    drepVotes: DRepVoteStats,
    spoVotes:  VoteCounts,
    ccVotes:   VoteCounts,
    expiresEpoch: Int,
    currentEpoch: Int,
    thresholds: GovernanceThresholds = GovernanceThresholds.DEFAULT,
): String {
    if (actionType == "infoAction") {
        return if (currentEpoch > expiresEpoch) "expired" else "active"
    }

    if (isRatified(actionType, drepVotes, spoVotes, ccVotes, thresholds)) {
        return "ratified"
    }

    return if (currentEpoch > expiresEpoch) "expired" else "active"
}

private fun isRatified(
    actionType: String,
    drepVotes:  DRepVoteStats,
    spoVotes:   VoteCounts,
    ccVotes:    VoteCounts,
    t:          GovernanceThresholds,
): Boolean {
    /** DRep yes-fraction against totalActiveDRepStake. */
    fun drepOk(threshold: Double, noConfidence: Boolean = false): Boolean {
        val denom = drepVotes.totalActiveDRepStake
        if (denom == 0L) return false
        val yes = if (noConfidence) drepVotes.yesVotingPower + drepVotes.autoNoConfidenceStake
                  else              drepVotes.yesVotingPower
        return yes.toDouble() / denom >= threshold
    }

    /** SPO yes-fraction against total votes cast (approx). */
    fun poolOk(threshold: Double): Boolean {
        val total = spoVotes.yes + spoVotes.no + spoVotes.abstain
        if (total == 0) return false
        return spoVotes.yes.toDouble() / total >= threshold
    }

    /** CC yes-fraction against active members (or votes cast if activeMembers = 0). */
    fun ccOk(): Boolean {
        val denom = if (ccVotes.activeMembers > 0) ccVotes.activeMembers
                    else (ccVotes.yes + ccVotes.no + ccVotes.abstain)
        if (denom == 0) return true   // no CC present → requirement vacuously satisfied
        val quorum = if (ccVotes.quorum > 0) ccVotes.quorum else (2.0 / 3)
        return ccVotes.yes.toDouble() / denom >= quorum
    }

    return when (actionType) {
        "noConfidence"             -> drepOk(t.drepNoConfidence, noConfidence = true)
                                        && poolOk(t.poolNoConfidence)

        "updateCommittee"          -> drepOk(t.drepCommitteeNormal)
                                        && poolOk(t.poolCommitteeNormal)

        "newConstitution"          -> drepOk(t.drepConstitution) && ccOk()

        "hardForkInitiation"       -> drepOk(t.drepHardFork)
                                        && poolOk(t.poolHardFork)
                                        && ccOk()

        "treasuryWithdrawals"      -> drepOk(t.drepTreasury) && ccOk()

        "protocolParametersUpdate" -> {
            // Full accuracy requires inspecting which param groups changed.
            // Use governance (most conservative, 0.75) as a safe default.
            drepOk(t.drepPpGovernance) && ccOk()
        }

        else -> false
    }
}
