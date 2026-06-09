package vote.tempo.db

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.cardano.GovernanceActionDto

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
}
