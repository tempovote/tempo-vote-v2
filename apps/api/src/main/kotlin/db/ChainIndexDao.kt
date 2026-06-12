package vote.tempo.db

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.VarCharColumnType
import vote.tempo.cardano.PoolInfo
import vote.tempo.cardano.VoteEntry

/**
 * Query layer for chain index tables populated by the extended VoteIndexer.
 * Replaces Koios API calls for: delegator counts, vote rationale URLs,
 * voted count per DRep, and pool metadata.
 */
object ChainIndexDao {

    /**
     * Count current delegators for a DRep.
     * Uses DISTINCT ON to resolve the latest delegation per stake credential in SQL,
     * avoiding a full table scan into memory.
     */
    fun getDelegatorCount(drepCredentialHex: String, network: String): Int = transaction {
        var count = 0
        exec(
            """SELECT COUNT(*) FROM (
                   SELECT DISTINCT ON (stake_credential_hex) drep_credential_hex
                   FROM idx_delegation_vote
                   WHERE network = ? AND drep_type IN ('key', 'script')
                   ORDER BY stake_credential_hex, slot DESC
               ) latest
               WHERE drep_credential_hex = ?""",
            listOf(
                Pair<IColumnType<*>, Any?>(VarCharColumnType(10), network),
                Pair<IColumnType<*>, Any?>(VarCharColumnType(56), drepCredentialHex),
            )
        ) { rs -> if (rs.next()) count = rs.getInt(1) }
        count
    }

    /**
     * Batch delegator counts for multiple DReps — single DB call.
     * Returns map of credentialHex → count.
     */
    fun getDelegatorCounts(drepCredentialHexes: List<String>, network: String): Map<String, Int> {
        if (drepCredentialHexes.isEmpty()) return emptyMap()
        return transaction { latestDelegationsByDrep(network).filter { it.key in drepCredentialHexes } }
    }

    /**
     * Compute Map<drepCredentialHex, delegatorCount> using a PostgreSQL DISTINCT ON query.
     * Resolves latest delegation per stake credential in the DB engine — result set is at
     * most one row per active DRep (hundreds), not one row per delegation cert (millions).
     */
    private fun latestDelegationsByDrep(network: String): Map<String, Int> {
        val result = mutableMapOf<String, Int>()
        transaction {
            exec(
                """SELECT drep_credential_hex, COUNT(*) AS cnt
                   FROM (
                       SELECT DISTINCT ON (stake_credential_hex) drep_credential_hex
                       FROM idx_delegation_vote
                       WHERE network = ? AND drep_type IN ('key', 'script')
                       ORDER BY stake_credential_hex, slot DESC
                   ) latest
                   WHERE drep_credential_hex IS NOT NULL
                   GROUP BY drep_credential_hex""",
                listOf(Pair<IColumnType<*>, Any?>(VarCharColumnType(10), network))
            ) { rs -> while (rs.next()) result[rs.getString(1)] = rs.getInt(2) }
        }
        return result
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

    /**
     * Load individual vote entries for a single proposal from drep_votes.
     * Used by the detail endpoint to populate the vote history tab for historical proposals
     * (getHistoricalFromIndex returns votes = emptyList() to avoid bloating the list response).
     * Capped at 2000 rows — enough to cover any realistic proposal.
     */
    fun getVoteEntriesForProposal(network: String, txHash: String, index: Int): List<VoteEntry> =
        transaction {
            DrepVotes
                .select(
                    DrepVotes.drepCredentialHex,
                    DrepVotes.voterRole,
                    DrepVotes.vote,
                    DrepVotes.anchorUrl,
                )
                .where {
                    (DrepVotes.network eq network) and
                    (DrepVotes.proposalTxHash eq txHash) and
                    (DrepVotes.proposalIndex eq index)
                }
                .orderBy(DrepVotes.slot, SortOrder.ASC)
                .limit(2000)
                .mapNotNull { row ->
                    val role = row[DrepVotes.voterRole]
                    if (role !in setOf("drep", "cc", "spo")) return@mapNotNull null
                    VoteEntry(
                        role         = role,
                        id           = row[DrepVotes.drepCredentialHex],
                        vote         = row[DrepVotes.vote],
                        votingPower  = 0L,
                        anchorUrl    = null,
                        rationaleUrl = row[DrepVotes.anchorUrl],
                        memberName   = null,
                        poolName     = null,
                        voterName    = null,
                    )
                }
        }

    /** Number of governance actions a DRep has voted on (DRep role only). */
    fun getVotedCount(drepCredentialHex: String, network: String): Int = transaction {
        DrepVotes
            .selectAll()
            .where {
                (DrepVotes.network eq network) and
                (DrepVotes.drepCredentialHex eq drepCredentialHex) and
                (DrepVotes.voterRole eq "drep")
            }
            .count()
            .toInt()
    }

    /**
     * Count governance actions a DRep voted on by scanning snapshot_json.votes[].
     * Used as fallback when VoteIndexer hasn't synced this network yet.
     * Snapshot JSON is written by BackgroundPoller for all proposals (active + historical).
     */
    fun getVotedCountFromSnapshots(drepCredentialHex: String, network: String): Int = transaction {
        exec(
            """
            SELECT COUNT(*)
            FROM governance_action_snapshots
            WHERE network = ?
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(snapshot_json::jsonb->'votes') v
                WHERE v->>'role' = 'drep' AND v->>'id' = ?
              )
            """.trimIndent(),
            listOf(
                Pair<IColumnType<*>, Any?>(VarCharColumnType(10), network),
                Pair<IColumnType<*>, Any?>(VarCharColumnType(56), drepCredentialHex),
            ),
        ) { rs -> if (rs.next()) rs.getInt(1) else 0 } ?: 0
    }

    /** Total distinct governance action proposals indexed so far. */
    fun getTotalProposalCount(network: String): Int = transaction {
        exec(
            "SELECT COUNT(DISTINCT proposal_tx_hash || '#' || proposal_index) FROM drep_votes WHERE network = ?",
            listOf(Pair<IColumnType<*>, Any?>(VarCharColumnType(10), network)),
        ) { rs -> if (rs.next()) rs.getInt(1) else 0 } ?: 0
    }

    /**
     * Returns pools that have a metadata URL but no name yet — these need async fetch.
     * Returns list of (poolIdHex, metadataUrl).
     */
    fun getPoolsNeedingMetadata(network: String): List<Pair<String, String>> = transaction {
        IdxPoolMetadata
            .select(IdxPoolMetadata.poolIdHex, IdxPoolMetadata.metadataUrl)
            .where {
                (IdxPoolMetadata.network eq network) and
                IdxPoolMetadata.name.isNull() and
                IdxPoolMetadata.metadataUrl.isNotNull()
            }
            .mapNotNull { row ->
                val hex = row[IdxPoolMetadata.poolIdHex]
                val url = row[IdxPoolMetadata.metadataUrl] ?: return@mapNotNull null
                hex to url
            }
    }

    /** Pool name/ticker/votingPower by bech32 pool ID. Returns null if not yet indexed. */
    fun getPoolInfo(poolIdBech32: String, network: String): Triple<String?, String?, Long>? = transaction {
        IdxPoolMetadata
            .select(IdxPoolMetadata.name, IdxPoolMetadata.ticker, IdxPoolMetadata.votingPower)
            .where {
                (IdxPoolMetadata.network eq network) and
                (IdxPoolMetadata.poolIdBech32 eq poolIdBech32)
            }
            .singleOrNull()
            ?.let { Triple(it[IdxPoolMetadata.name], it[IdxPoolMetadata.ticker], it[IdxPoolMetadata.votingPower] ?: 0L) }
    }

    /**
     * Batch read pool info for multiple bech32 pool IDs from local DB.
     * Returns Map<bech32, PoolInfo>. Missing pools get PoolInfo(name=null, votingPower=0L).
     * Used at request time — no external API calls.
     */
    fun getPoolInfoMap(poolIdsBech32: List<String>, network: String): Map<String, PoolInfo> {
        if (poolIdsBech32.isEmpty()) return emptyMap()
        val result = mutableMapOf<String, PoolInfo>()
        transaction {
            IdxPoolMetadata
                .select(IdxPoolMetadata.poolIdBech32, IdxPoolMetadata.name, IdxPoolMetadata.votingPower)
                .where {
                    (IdxPoolMetadata.network eq network) and
                    (IdxPoolMetadata.poolIdBech32 inList poolIdsBech32)
                }
                .forEach { row ->
                    result[row[IdxPoolMetadata.poolIdBech32]] = PoolInfo(
                        name        = row[IdxPoolMetadata.name],
                        votingPower = row[IdxPoolMetadata.votingPower] ?: 0L,
                    )
                }
        }
        return result
    }

    /** Upsert pool name/ticker after fetching metadata URL (PoolMetadataFetcher path). */
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

    /**
     * Upsert pool name, ticker, and live stake from Blockfrost into idx_pool_metadata.
     * INSERT ON CONFLICT — inserts a new row if the pool isn't in local DB yet
     * (i.e. VoteIndexer hasn't seen a registration cert for it), and updates
     * name/ticker/voting_power on conflict.
     * slot = 0 for Blockfrost-sourced rows (no chain slot known).
     */
    fun upsertPoolFromBlockfrost(
        network: String,
        poolIdBech32: String,
        poolIdHex: String,
        name: String?,
        ticker: String?,
        votingPower: Long,
    ) = transaction {
        IdxPoolMetadata.upsert(IdxPoolMetadata.network, IdxPoolMetadata.poolIdHex) {
            it[IdxPoolMetadata.network]      = network
            it[IdxPoolMetadata.poolIdBech32] = poolIdBech32
            it[IdxPoolMetadata.poolIdHex]    = poolIdHex
            it[IdxPoolMetadata.name]         = name
            it[IdxPoolMetadata.ticker]       = ticker
            it[IdxPoolMetadata.votingPower]  = votingPower
            it[IdxPoolMetadata.slot]         = 0L   // unknown slot for Blockfrost-sourced rows
        }
    }

    /**
     * Replace all delegator stakes for a DRep (network + credHex) with fresh Blockfrost data.
     * DELETE + batch INSERT inside a single transaction — keeps the table consistent even if
     * delegators have left since the last poll.
     */
    fun upsertDRepDelegators(
        networkName: String,
        credHex: String,
        delegators: List<Pair<String, Long>>,   // (stakeAddress, lovelaceAmount)
    ) = transaction {
        DrepDelegatorStakes.deleteWhere {
            (DrepDelegatorStakes.network eq networkName) and
            (DrepDelegatorStakes.drepCredentialHex eq credHex)
        }
        if (delegators.isNotEmpty()) {
            DrepDelegatorStakes.batchInsert(delegators, shouldReturnGeneratedValues = false) { (address, amt) ->
                this[DrepDelegatorStakes.network]           = networkName
                this[DrepDelegatorStakes.drepCredentialHex] = credHex
                this[DrepDelegatorStakes.stakeAddress]      = address
                this[DrepDelegatorStakes.amount]            = amt
            }
        }
    }

    /**
     * Return top [limit] DReps ranked by number of delegators with amount > [thresholdLovelace].
     * Result list: (drepCredentialHex, whaleCount), sorted descending.
     */
    fun getWhaleLeaders(
        networkName: String,
        limit: Int,
        thresholdLovelace: Long = 1_000_000_000_000L,
    ): List<Pair<String, Int>> {
        val result = mutableListOf<Pair<String, Int>>()
        transaction {
            exec(
                """SELECT drep_credential_hex, COUNT(*) AS whale_count
                   FROM drep_delegator_stakes
                   WHERE network = ? AND amount > ?
                   GROUP BY drep_credential_hex
                   ORDER BY whale_count DESC
                   LIMIT ?""",
                listOf(
                    Pair<IColumnType<*>, Any?>(VarCharColumnType(10), networkName),
                    Pair<IColumnType<*>, Any?>(LongColumnType(), thresholdLovelace),
                    Pair<IColumnType<*>, Any?>(IntegerColumnType(), limit),
                ),
            ) { rs -> while (rs.next()) result.add(rs.getString(1) to rs.getInt(2)) }
        }
        return result
    }
}
