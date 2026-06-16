package vote.tempo.db

import org.jetbrains.exposed.sql.kotlin.datetime.CurrentDateTime
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.upsert

/**
 * Single-row store for the Cardano DApp ranking snapshot (FE-shaped JSON payload).
 * Written by BackgroundPoller every 2h, read by GET /dapp-ranking.
 */
object DappRankingDao {
    private const val ROW_ID = "cardano"

    /** Returns the stored snapshot JSON, or null if no snapshot has been written yet. */
    fun get(): String? = transaction {
        CardanoDappSnapshot.selectAll()
            .where { CardanoDappSnapshot.id eq ROW_ID }
            .firstOrNull()
            ?.get(CardanoDappSnapshot.snapshotJson)
    }

    fun upsert(snapshotJson: String) = transaction {
        CardanoDappSnapshot.upsert(CardanoDappSnapshot.id) {
            it[CardanoDappSnapshot.id]           = ROW_ID
            it[CardanoDappSnapshot.snapshotJson] = snapshotJson
            it[CardanoDappSnapshot.updatedAt]    = CurrentDateTime
        }
    }
}
