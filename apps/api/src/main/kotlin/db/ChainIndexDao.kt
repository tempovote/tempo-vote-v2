package vote.tempo.db

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.VarCharColumnType

/**
 * Query layer for chain index tables populated by the extended VoteIndexer.
 * Replaces Koios API calls for: delegator counts, vote rationale URLs,
 * voted count per DRep, and pool metadata.
 */
object ChainIndexDao {

    /**
     * Count current delegators for a DRep.
     * "Current" = stake credentials whose latest delegation (highest slot) points to this DRep.
     */
    fun getDelegatorCount(drepCredentialHex: String, network: String): Int = transaction {
        latestDelegationsByDrep(network)[drepCredentialHex] ?: 0
    }

    /**
     * Batch delegator counts for multiple DReps — single DB call.
     * Returns map of credentialHex → count.
     */
    fun getDelegatorCounts(drepCredentialHexes: List<String>, network: String): Map<String, Int> {
        if (drepCredentialHexes.isEmpty()) return emptyMap()
        return transaction {
            latestDelegationsByDrep(network).filter { it.key in drepCredentialHexes }
        }
    }

    /**
     * Compute Map<drepCredentialHex, delegatorCount> by loading all active delegations
     * and grouping in memory. Keeps only the latest delegation per stake credential.
     * Conway-era delegation table is small (~hundreds of thousands of rows at most).
     */
    private fun latestDelegationsByDrep(network: String): Map<String, Int> {
        // Load all delegation rows ordered by slot DESC — first occurrence per stake cred is latest
        val rows = IdxDelegationVote
            .selectAll()
            .where {
                (IdxDelegationVote.network eq network) and
                (IdxDelegationVote.drepType inList listOf("key", "script"))
            }
            .orderBy(IdxDelegationVote.stakeCredentialHex, SortOrder.ASC)
            .orderBy(IdxDelegationVote.slot, SortOrder.DESC)
            .toList()

        // For each stake credential, keep the row with the highest slot (latest delegation)
        val latestByStake = linkedMapOf<String, String>()  // stakeHex → drepHex
        for (row in rows) {
            val stakeHex = row[IdxDelegationVote.stakeCredentialHex]
            if (!latestByStake.containsKey(stakeHex)) {
                val drepHex = row[IdxDelegationVote.drepCredentialHex] ?: continue
                latestByStake[stakeHex] = drepHex
            }
        }

        // Aggregate: count delegators per DRep
        return latestByStake.values.groupingBy { it }.eachCount()
    }

    /**
     * Vote rationale URLs for a governance action proposal.
     * Returns map of voterHex → anchorUrl.
     */
    fun getVoteRationales(proposalTxHash: String, proposalIndex: Int, network: String): Map<String, String> =
        transaction {
            DrepVotes
                .select(DrepVotes.drepCredentialHex, DrepVotes.anchorUrl)
                .where {
                    (DrepVotes.network eq network) and
                    (DrepVotes.proposalTxHash eq proposalTxHash) and
                    (DrepVotes.proposalIndex eq proposalIndex) and
                    DrepVotes.anchorUrl.isNotNull()
                }
                .associate { it[DrepVotes.drepCredentialHex] to it[DrepVotes.anchorUrl]!! }
        }

    /**
     * Build rationale maps for multiple proposals at once.
     * Returns Map<"txHash#index", Map<voterHex, rationaleUrl>>.
     */
    fun buildRationalesMap(
        proposals: List<Pair<String, Int>>,
        network: String,
    ): Map<String, Map<String, String>> {
        if (proposals.isEmpty()) return emptyMap()
        return transaction {
            val result = mutableMapOf<String, MutableMap<String, String>>()
            for ((txHash, index) in proposals) {
                val rationales = DrepVotes
                    .select(DrepVotes.drepCredentialHex, DrepVotes.anchorUrl)
                    .where {
                        (DrepVotes.network eq network) and
                        (DrepVotes.proposalTxHash eq txHash) and
                        (DrepVotes.proposalIndex eq index) and
                        DrepVotes.anchorUrl.isNotNull()
                    }
                    .associate { it[DrepVotes.drepCredentialHex] to it[DrepVotes.anchorUrl]!! }
                if (rationales.isNotEmpty()) result["$txHash#$index"] = rationales.toMutableMap()
            }
            result
        }
    }

    /** Number of governance actions a DRep has voted on. */
    fun getVotedCount(drepCredentialHex: String, network: String): Int = transaction {
        DrepVotes
            .selectAll()
            .where {
                (DrepVotes.network eq network) and
                (DrepVotes.drepCredentialHex eq drepCredentialHex)
            }
            .count()
            .toInt()
    }

    /** Total distinct governance action proposals indexed so far. */
    fun getTotalProposalCount(network: String): Int = transaction {
        exec(
            "SELECT COUNT(DISTINCT proposal_tx_hash || '#' || proposal_index) FROM drep_votes WHERE network = ?",
            listOf(Pair<IColumnType<*>, Any?>(VarCharColumnType(10), network)),
        ) { rs -> if (rs.next()) rs.getInt(1) else 0 } ?: 0
    }

    /** Pool name/ticker by bech32 pool ID. Returns null if not yet indexed. */
    fun getPoolInfo(poolIdBech32: String, network: String): Pair<String?, String?>? = transaction {
        IdxPoolMetadata
            .select(IdxPoolMetadata.name, IdxPoolMetadata.ticker)
            .where {
                (IdxPoolMetadata.network eq network) and
                (IdxPoolMetadata.poolIdBech32 eq poolIdBech32)
            }
            .singleOrNull()
            ?.let { it[IdxPoolMetadata.name] to it[IdxPoolMetadata.ticker] }
    }

    /** Upsert pool name/ticker after fetching metadata URL. */
    fun updatePoolName(network: String, poolIdHex: String, name: String?, ticker: String?) =
        transaction {
            IdxPoolMetadata.update({
                (IdxPoolMetadata.network eq network) and
                (IdxPoolMetadata.poolIdHex eq poolIdHex)
            }) {
                it[IdxPoolMetadata.name]   = name
                it[IdxPoolMetadata.ticker] = ticker
            }
        }
}
