package vote.tempo.cardano

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.db.DrepVotes
import vote.tempo.db.IdxDelegationVote
import vote.tempo.db.IdxPoolMetadata
import vote.tempo.db.IndexerCheckpoint

private val logger = KotlinLogging.logger("VoteIndexer")

// Conway era start slots — skip all blocks before these
private val CONWAY_SLOTS = mapOf(
    "mainnet" to 133_660_800L,
    "preprod" to  68_774_400L,
)

private val SLOTS_PER_EPOCH = mapOf("mainnet" to 432_000L, "preprod" to 86_400L)

private const val PIPELINE_SIZE = 200

private val wsClient = HttpClient(CIO) {
    install(WebSockets)
}

/**
 * Extended chain-sync indexer. Streams blocks from Ogmios and indexes:
 *  - All governance votes (DRep, CC, SPO) with rationale anchor URLs → drep_votes
 *  - Vote delegation certificates (Conway) → idx_delegation_vote
 *  - Stake pool registration metadata → idx_pool_metadata
 *
 * Starts from genesis but skips pre-Conway blocks cheaply (no DB I/O).
 * Checkpointing ensures restarts don't duplicate work.
 */
suspend fun runVoteIndexer(network: String, ogmiosUrl: String) {
    val wsUrl = ogmiosUrl
        .replace("https://", "wss://")
        .replace("http://",  "ws://")

    val conwayStartSlot = CONWAY_SLOTS[network] ?: 0L
    val slotsPerEpoch   = SLOTS_PER_EPOCH[network] ?: 432_000L

    while (true) {
        try {
            val checkpoint = loadCheckpoint(network)
            logger.info { "VoteIndexer [$network] connecting (checkpoint slot=${checkpoint?.first ?: "none"})" }

            wsClient.webSocket(wsUrl) {
                var inFlight = 0L
                repeat(PIPELINE_SIZE) { sendNextBlock(inFlight++) }

                var lastCheckpointMs = System.currentTimeMillis()
                var blocksProcessed  = 0L
                var votesInserted    = 0L
                var delegsInserted   = 0L
                var poolsInserted    = 0L

                for (frame in incoming) {
                    if (frame !is Frame.Text) continue
                    val msg = parseJson(frame.readText()) ?: run {
                        sendNextBlock(inFlight++)
                        continue
                    }

                    val result = msg["result"]?.jsonObject
                    if (result == null) {
                        sendNextBlock(inFlight++)
                        continue
                    }

                    val direction = result["direction"]?.jsonPrimitive?.contentOrNull
                    if (direction == "backward") {
                        sendNextBlock(inFlight++)
                        continue
                    }

                    val block = result["block"]?.jsonObject ?: run {
                        sendNextBlock(inFlight++)
                        continue
                    }

                    val slot      = block["slot"]?.jsonPrimitive?.longOrNull ?: 0L
                    val blockHash = block["id"]?.jsonPrimitive?.contentOrNull ?: ""
                    blocksProcessed++

                    if (slot >= conwayStartSlot) {
                        val checkpointSlot = checkpoint?.first ?: 0L

                        if (slot > checkpointSlot) {
                            val txs = block["transactions"]?.jsonArray ?: JsonArray(emptyList())
                            for (tx in txs) {
                                val txObj  = runCatching { tx.jsonObject }.getOrNull() ?: continue
                                val txHash = txObj["id"]?.jsonPrimitive?.contentOrNull ?: continue
                                val epoch  = (slot / slotsPerEpoch).toInt()

                                // Governance votes (DRep + CC + SPO)
                                val votes = txObj["votes"]?.jsonArray ?: JsonArray(emptyList())
                                for (vp in votes) {
                                    if (indexVote(network, slot, epoch, txHash, vp.jsonObject))
                                        votesInserted++
                                }

                                // Certificates: delegation + pool registration
                                val certs = txObj["certificates"]?.jsonArray ?: JsonArray(emptyList())
                                for (cert in certs) {
                                    val certObj = runCatching { cert.jsonObject }.getOrNull() ?: continue
                                    when (certObj["type"]?.jsonPrimitive?.contentOrNull) {
                                        "voteDelegation",
                                        "stakeVoteDelegation",
                                        "voteRegistrationDelegation",
                                        "stakeVoteRegistrationDelegation" -> {
                                            if (indexDelegationCert(network, slot, txHash, certObj))
                                                delegsInserted++
                                        }
                                        "stakePoolRegistration" -> {
                                            if (indexPoolRegistration(network, slot, certObj))
                                                poolsInserted++
                                        }
                                    }
                                }
                            }
                        }

                        val now = System.currentTimeMillis()
                        if (now - lastCheckpointMs >= 60_000 && blockHash.isNotEmpty()) {
                            saveCheckpoint(network, slot, blockHash)
                            lastCheckpointMs = now
                            logger.info {
                                "VoteIndexer [$network] slot=$slot blocks=$blocksProcessed " +
                                "votes=$votesInserted delegs=$delegsInserted pools=$poolsInserted"
                            }
                        }
                    }

                    sendNextBlock(inFlight++)
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            logger.warn { "VoteIndexer [$network] error: ${e.message} — retrying in 30s" }
            delay(30_000)
        }
    }
}

// ── Vote indexing ─────────────────────────────────────────────────────────────

private fun indexVote(
    network: String,
    slot: Long,
    epoch: Int,
    txHash: String,
    vp: JsonObject,
): Boolean {
    val voter  = vp["voter"]?.jsonObject ?: return false
    val role   = voter["role"]?.jsonPrimitive?.contentOrNull ?: return false

    // Map all three voter roles to a credential hex
    val credentialHex: String = when (role) {
        "delegateRepresentative" -> {
            val id = voter["id"]?.jsonPrimitive?.contentOrNull ?: return false
            runCatching { drepIdToCredentialHex(id) }.getOrElse { id }
                .takeIf { it.length == 56 } ?: return false
        }
        "constitutionalCommitteeMember" -> {
            // CC member identified by hot key credential hex
            voter["id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.length == 56 } ?: return false
        }
        "stakePoolOperator" -> {
            // SPO identified by pool bech32 ID
            voter["id"]?.jsonPrimitive?.contentOrNull ?: return false
        }
        else -> return false
    }

    val actionId       = vp["actionId"]?.jsonObject ?: return false
    val proposalTxHash = actionId["transaction"]?.jsonObject?.get("id")
        ?.jsonPrimitive?.contentOrNull ?: return false
    val proposalIndex  = actionId["index"]?.jsonPrimitive?.intOrNull ?: 0
    val vote           = vp["vote"]?.jsonPrimitive?.contentOrNull ?: return false
    val anchorUrl      = vp["anchor"]?.jsonObject?.get("url")?.jsonPrimitive?.contentOrNull

    return try {
        transaction {
            DrepVotes.upsert(
                keys = arrayOf(
                    DrepVotes.network,
                    DrepVotes.drepCredentialHex,
                    DrepVotes.proposalTxHash,
                    DrepVotes.proposalIndex,
                ),
            ) {
                it[DrepVotes.network]           = network
                it[DrepVotes.drepCredentialHex] = credentialHex
                it[DrepVotes.txHash]            = txHash
                it[DrepVotes.proposalTxHash]    = proposalTxHash
                it[DrepVotes.proposalIndex]     = proposalIndex
                it[DrepVotes.vote]              = vote
                it[DrepVotes.epoch]             = epoch
                it[DrepVotes.slot]              = slot
                if (anchorUrl != null) it[DrepVotes.anchorUrl] = anchorUrl
            }
        }
        true
    } catch (_: Exception) { false }
}

// ── Delegation cert indexing ──────────────────────────────────────────────────

private fun indexDelegationCert(
    network: String,
    slot: Long,
    txHash: String,
    cert: JsonObject,
): Boolean {
    // Ogmios 6.x cert formats for Conway delegation:
    //   voteDelegation            → credential + delegatee
    //   stakeVoteDelegation       → credential + stake pool + delegatee
    //   voteRegistrationDelegation         → credential + delegatee + deposit
    //   stakeVoteRegistrationDelegation    → credential + stake pool + delegatee + deposit
    val credential = cert["credential"]?.jsonObject ?: return false
    val stakeHex   = credential["keyHash"]?.jsonPrimitive?.contentOrNull
        ?: credential["scriptHash"]?.jsonPrimitive?.contentOrNull
        ?: return false

    val delegatee = cert["delegatee"]?.jsonObject ?: return false
    val delegateeType = delegatee["type"]?.jsonPrimitive?.contentOrNull ?: return false

    val (drepType, drepHex) = when (delegateeType) {
        "drep" -> {
            val drep    = delegatee["drep"]?.jsonObject ?: return false
            val subType = drep["type"]?.jsonPrimitive?.contentOrNull ?: return false
            when (subType) {
                "keyHash"    -> "key"    to drep["keyHash"]?.jsonPrimitive?.contentOrNull
                "scriptHash" -> "script" to drep["scriptHash"]?.jsonPrimitive?.contentOrNull
                else         -> return false
            }
        }
        "alwaysAbstain"       -> "abstain"       to null
        "alwaysNoConfidence"  -> "no_confidence" to null
        else                  -> return false
    }

    return try {
        transaction {
            IdxDelegationVote.insert {
                it[IdxDelegationVote.network]            = network
                it[IdxDelegationVote.stakeCredentialHex] = stakeHex
                it[IdxDelegationVote.drepCredentialHex]  = drepHex
                it[IdxDelegationVote.drepType]           = drepType
                it[IdxDelegationVote.txHash]             = txHash
                it[IdxDelegationVote.slot]               = slot
            }
        }
        true
    } catch (_: Exception) { false }
}

// ── Pool registration indexing ───────────────────────────────────────────────

private fun indexPoolRegistration(
    network: String,
    slot: Long,
    cert: JsonObject,
): Boolean {
    // Ogmios 6.x format: certificates[].poolParameters.id (bech32) + .metadata.url
    val poolParams  = cert["poolParameters"]?.jsonObject ?: return false
    val poolBech32  = poolParams["id"]?.jsonPrimitive?.contentOrNull ?: return false
    val metadataUrl = poolParams["metadata"]?.jsonObject?.get("url")
        ?.jsonPrimitive?.contentOrNull

    // Pool ID hex: decode bech32 → skip for now; store empty, update after name fetch
    val poolHex = runCatching { bech32ToHex(poolBech32) }.getOrElse { "" }
        .takeIf { it.isNotEmpty() } ?: poolBech32  // fallback: use bech32 as key

    return try {
        transaction {
            IdxPoolMetadata.upsert(IdxPoolMetadata.network, IdxPoolMetadata.poolIdHex) {
                it[IdxPoolMetadata.network]      = network
                it[IdxPoolMetadata.poolIdBech32] = poolBech32
                it[IdxPoolMetadata.poolIdHex]    = poolHex
                it[IdxPoolMetadata.metadataUrl]  = metadataUrl
                it[IdxPoolMetadata.slot]         = slot
            }
        }
        true
    } catch (_: Exception) { false }
}

// ── bech32 helper ─────────────────────────────────────────────────────────────

private fun bech32ToHex(bech32: String): String {
    // pool1... → strip hrp + checksum, decode 5-bit groups to bytes
    // Simple implementation using the bech32 decoding from cardano-client-lib already on classpath
    val data = com.bloxbean.cardano.client.crypto.Bech32.decode(bech32).data
    return data.joinToString("") { "%02x".format(it) }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

private fun loadCheckpoint(network: String): Pair<Long, String>? =
    runCatching {
        transaction {
            IndexerCheckpoint.selectAll()
                .where { IndexerCheckpoint.network eq network }
                .singleOrNull()
                ?.let { it[IndexerCheckpoint.slot] to it[IndexerCheckpoint.blockHash] }
        }
    }.getOrNull()

private fun saveCheckpoint(network: String, slot: Long, blockHash: String) {
    runCatching {
        transaction {
            IndexerCheckpoint.upsert(IndexerCheckpoint.network) {
                it[IndexerCheckpoint.network]   = network
                it[IndexerCheckpoint.slot]      = slot
                it[IndexerCheckpoint.blockHash] = blockHash
            }
        }
    }
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

private var reqId = 0L

private suspend fun DefaultClientWebSocketSession.sendNextBlock(id: Long) =
    send(Frame.Text("""{"jsonrpc":"2.0","method":"nextBlock","params":{},"id":$id}"""))

private fun parseJson(text: String): JsonObject? =
    runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull()
