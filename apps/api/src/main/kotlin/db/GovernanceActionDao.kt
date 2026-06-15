package vote.tempo.db

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.cardano.DRepVoteStats
import vote.tempo.cardano.GovernanceActionDto
import vote.tempo.cardano.SPOVoteStats
import vote.tempo.cardano.VoteCounts
import vote.tempo.cardano.actionTypeLabel

private val logger = KotlinLogging.logger("GovernanceActionDao")

private val json = Json { ignoreUnknownKeys = true }

object GovernanceActionDao {

    /**
     * Upsert all currently-live proposals and mark any that disappeared from Ogmios
     * with their final status (expired / enacted / dropped).
     *
     * Called by BackgroundPoller after each successful govActions refresh.
     */
    fun sync(proposals: List<GovernanceActionDto>, network: String, currentEpoch: Int) {
        runCatching {
            transaction {
                val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)
                val currentKeys = proposals.map { Pair(it.txHash, it.index) }.toSet()

                // 1. Upsert each live proposal — preserve firstSeenAt on conflict.
                for (proposal in proposals) {
                    val jsonStr = json.encodeToString(proposal)
                    GovernanceActionSnapshots.upsert(
                        GovernanceActionSnapshots.txHash,
                        GovernanceActionSnapshots.index,
                        GovernanceActionSnapshots.network,
                        onUpdateExclude = listOf(GovernanceActionSnapshots.firstSeenAt),
                    ) {
                        it[txHash]       = proposal.txHash
                        it[index]        = proposal.index
                        it[this.network] = network
                        it[expiresEpoch] = proposal.expiresEpoch
                        it[status]       = proposal.status
                        it[snapshotJson] = jsonStr
                        it[firstSeenAt]  = now
                        it[lastSeenAt]   = now
                    }
                }

                // 2. Proposals that were active/ratified but are no longer in Ogmios
                //    have been enacted, expired, or dropped — compute final status.
                val disappeared = GovernanceActionSnapshots.selectAll()
                    .where {
                        (GovernanceActionSnapshots.network eq network) and
                        (GovernanceActionSnapshots.status inList listOf("active", "ratified"))
                    }
                    .filter { row ->
                        Pair(row[GovernanceActionSnapshots.txHash], row[GovernanceActionSnapshots.index]) !in currentKeys
                    }

                for (row in disappeared) {
                    val finalStatus = when {
                        row[GovernanceActionSnapshots.status] == "ratified"             -> "enacted"
                        currentEpoch > row[GovernanceActionSnapshots.expiresEpoch]      -> "expired"
                        else                                                             -> "dropped"
                    }
                    GovernanceActionSnapshots.update({
                        (GovernanceActionSnapshots.txHash    eq row[GovernanceActionSnapshots.txHash]) and
                        (GovernanceActionSnapshots.index     eq row[GovernanceActionSnapshots.index]) and
                        (GovernanceActionSnapshots.network   eq row[GovernanceActionSnapshots.network])
                    }) {
                        it[status]      = finalStatus
                        it[lastSeenAt]  = now
                    }
                }

                if (disappeared.isNotEmpty()) {
                    logger.info { "GovernanceActionDao [$network] epoch=$currentEpoch upserted=${proposals.size} finalized=${disappeared.size}" }
                } else {
                    logger.debug { "GovernanceActionDao [$network] epoch=$currentEpoch upserted=${proposals.size}" }
                }
            }

            // Persist per-voter voting_power into drep_votes so that when a proposal later
            // expires and leaves Ogmios, historical detail views can still show real power.
            for (proposal in proposals) {
                if (proposal.votes.isNotEmpty()) {
                    ChainIndexDao.updateVotingPowerForProposal(
                        network, proposal.txHash, proposal.index, proposal.votes
                    )
                }
            }
        }.onFailure { e ->
            logger.warn { "GovernanceActionDao.sync failed (DB unavailable?): ${e.message}" }
        }
    }

    /**
     * Return historical proposals (expired / enacted / dropped) for a network.
     * The caller is responsible for filtering out any proposals still live in Ogmios.
     */
    fun getHistorical(network: String): List<GovernanceActionDto> = runCatching {
        transaction {
            GovernanceActionSnapshots.selectAll()
                .where {
                    (GovernanceActionSnapshots.network eq network) and
                    (GovernanceActionSnapshots.status notInList listOf("active", "ratified"))
                }
                .orderBy(GovernanceActionSnapshots.expiresEpoch, SortOrder.DESC)
                .mapNotNull { row ->
                    runCatching {
                        json.decodeFromString<GovernanceActionDto>(row[GovernanceActionSnapshots.snapshotJson])
                            .copy(status = row[GovernanceActionSnapshots.status])
                    }.getOrNull()
                }
        }
    }.getOrDefault(emptyList())

    /**
     * Return proposals from the chain index (idx_governance_proposals) that
     * BackgroundPoller never observed. These cover pre-deployment history.
     *
     * Vote counts are sourced from drep_votes (via GROUP BY in SQL — no per-row voting power).
     * The caller must filter out keys already served by getHistorical() or live Ogmios.
     */
    fun getHistoricalFromIndex(network: String, currentEpoch: Int): List<GovernanceActionDto> = runCatching {
        transaction {
            val rows = IdxGovernanceProposals.selectAll()
                .where { IdxGovernanceProposals.network eq network }
                .orderBy(IdxGovernanceProposals.expiresEpoch, SortOrder.DESC)
                .toList()

            if (rows.isEmpty()) return@transaction emptyList<GovernanceActionDto>()

            // Aggregate vote counts + voting_power per (proposalTxHash, proposalIndex, voterRole, vote) in SQL.
            // voting_power is populated by BackgroundPoller for active proposals — 0 for pre-deployment GAs.
            data class VoteTally(
                var drepYes: Int = 0, var drepNo: Int = 0, var drepAbstain: Int = 0,
                var ccYes: Int   = 0, var ccNo: Int   = 0, var ccAbstain: Int   = 0,
                var spoYes: Int  = 0, var spoNo: Int  = 0, var spoAbstain: Int  = 0,
                var drepYesPower: Long = 0L, var drepNoPower: Long = 0L, var drepAbstainPower: Long = 0L,
            )

            val tally = mutableMapOf<String, VoteTally>()
            val cnt   = DrepVotes.id.count()
            val power = DrepVotes.votingPower.sum()

            DrepVotes
                .select(DrepVotes.proposalTxHash, DrepVotes.proposalIndex, DrepVotes.voterRole, DrepVotes.vote, cnt, power)
                .where { DrepVotes.network eq network }
                .groupBy(DrepVotes.proposalTxHash, DrepVotes.proposalIndex, DrepVotes.voterRole, DrepVotes.vote)
                .forEach { r ->
                    val key      = "${r[DrepVotes.proposalTxHash]}:${r[DrepVotes.proposalIndex]}"
                    val t        = tally.getOrPut(key) { VoteTally() }
                    val count    = r[cnt].toInt()
                    val totalPow = r[power] ?: 0L
                    when (r[DrepVotes.voterRole]) {
                        "drep" -> when (r[DrepVotes.vote]) {
                            "yes"     -> { t.drepYes     += count; t.drepYesPower     += totalPow }
                            "no"      -> { t.drepNo      += count; t.drepNoPower      += totalPow }
                            else      -> { t.drepAbstain += count; t.drepAbstainPower += totalPow }
                        }
                        "cc"   -> when (r[DrepVotes.vote]) { "yes" -> t.ccYes   += count; "no" -> t.ccNo   += count; else -> t.ccAbstain   += count }
                        "spo"  -> when (r[DrepVotes.vote]) { "yes" -> t.spoYes  += count; "no" -> t.spoNo  += count; else -> t.spoAbstain  += count }
                    }
                }

            rows.map { row ->
                val txHash       = row[IdxGovernanceProposals.txHash]
                val index        = row[IdxGovernanceProposals.index]
                val actionType   = row[IdxGovernanceProposals.actionType]
                val expiresEpoch = row[IdxGovernanceProposals.expiresEpoch]
                val t = tally["$txHash:$index"] ?: VoteTally()
                val status = row[IdxGovernanceProposals.finalStatus]
                    ?: if (currentEpoch > expiresEpoch) "expired" else "active"

                GovernanceActionDto(
                    txHash       = txHash,
                    index        = index,
                    type         = actionTypeLabel(actionType),
                    actionType   = actionType,
                    anchorUrl    = row[IdxGovernanceProposals.anchorUrl],
                    anchorHash   = row[IdxGovernanceProposals.anchorHash],
                    expiresEpoch = expiresEpoch,
                    deposit      = row[IdxGovernanceProposals.deposit],
                    drepVotes    = DRepVoteStats(t.drepYes, t.drepNo, t.drepAbstain, t.drepYesPower, t.drepNoPower, t.drepAbstainPower, 0L, 0L, 0L),
                    spoVotes     = SPOVoteStats(t.spoYes, t.spoNo, t.spoAbstain),
                    ccVotes      = VoteCounts(t.ccYes, t.ccNo, t.ccAbstain),
                    votes        = emptyList(),
                    details      = row[IdxGovernanceProposals.actionDetails]
                        ?.let { runCatching { Json.parseToJsonElement(it) }.getOrNull() },
                    status       = status,
                    title        = row[IdxGovernanceProposals.title],
                )
            }
        }
    }.getOrDefault(emptyList())

    /**
     * Set final_status for a batch of proposals in idx_governance_proposals.
     * Used by the backfill-enacted admin route to mark proposals whose real status
     * (enacted/dropped) differs from what epoch-based computation would produce.
     * Returns the number of rows actually updated.
     */
    fun markFinalStatus(network: String, keys: List<Pair<String, Int>>, status: String): Int {
        if (keys.isEmpty()) return 0
        return runCatching {
            transaction {
                var updated = 0
                for ((txHash, index) in keys) {
                    updated += IdxGovernanceProposals.update({
                        (IdxGovernanceProposals.network eq network) and
                        (IdxGovernanceProposals.txHash  eq txHash) and
                        (IdxGovernanceProposals.index   eq index)
                    }) {
                        it[IdxGovernanceProposals.finalStatus] = status
                    }
                }
                updated
            }
        }.getOrElse { e ->
            logger.warn { "GovernanceActionDao.markFinalStatus failed: ${e.message}" }
            0
        }
    }

    /**
     * (txHash, index) of the most-recently-enacted proposal among the given action types,
     * or null. A new proposal of the same purpose must chain its prevGovActionId to this
     * (CIP-1694; ledger rejects otherwise with error 3159). actionTypes are raw Ogmios
     * types, e.g. ["constitutionalCommittee", "noConfidence"] for the committee purpose.
     */
    fun getLastEnactedActionId(network: String, actionTypes: List<String>): Pair<String, Int>? =
        runCatching {
            transaction {
                IdxGovernanceProposals.selectAll()
                    .where {
                        (IdxGovernanceProposals.network eq network) and
                        (IdxGovernanceProposals.actionType inList actionTypes) and
                        (IdxGovernanceProposals.finalStatus eq "enacted")
                    }
                    .orderBy(IdxGovernanceProposals.submittedSlot, SortOrder.DESC)
                    .limit(1)
                    .firstOrNull()
                    ?.let { it[IdxGovernanceProposals.txHash] to it[IdxGovernanceProposals.index] }
            }
        }.getOrNull()
}
