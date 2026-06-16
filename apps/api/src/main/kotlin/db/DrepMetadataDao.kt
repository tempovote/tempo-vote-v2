package vote.tempo.db

import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.kotlin.datetime.CurrentDateTime
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.upsert
import vote.tempo.routes.DRepMeta

/**
 * Persistent (DB-backed) cache of DRep metadata fetched from anchor URLs.
 * Acts as the L2 cache between the in-memory drepInfo cache and the IPFS/anchor fetch,
 * so flaky gateways are hit at most once per DRep (until its anchor changes).
 */
object DrepMetadataDao {
    private val json = Json { ignoreUnknownKeys = true }

    /** Returns (storedAnchorUrl, meta) if a row exists, else null. */
    internal fun get(network: String, credHex: String): Pair<String?, DRepMeta>? = transaction {
        DrepMetadata.selectAll()
            .where { (DrepMetadata.network eq network) and (DrepMetadata.credHex eq credHex) }
            .firstOrNull()
            ?.let { row ->
                val meta = runCatching {
                    json.decodeFromString(DRepMeta.serializer(), row[DrepMetadata.metaJson])
                }.getOrNull() ?: return@let null
                row[DrepMetadata.anchorUrl] to meta
            }
    }

    internal fun upsert(network: String, credHex: String, anchorUrl: String?, meta: DRepMeta) = transaction {
        DrepMetadata.upsert(DrepMetadata.network, DrepMetadata.credHex) {
            it[DrepMetadata.network]   = network
            it[DrepMetadata.credHex]   = credHex
            it[DrepMetadata.anchorUrl] = anchorUrl
            it[DrepMetadata.name]      = meta.name
            it[DrepMetadata.imageUrl]  = meta.imageUrl
            it[DrepMetadata.metaJson]  = json.encodeToString(DRepMeta.serializer(), meta)
            it[DrepMetadata.updatedAt] = CurrentDateTime
        }
    }
}
