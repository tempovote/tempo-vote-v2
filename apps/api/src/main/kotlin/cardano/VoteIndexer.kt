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
import vote.tempo.db.IndexerCheckpoint

private val logger = KotlinLogging.logger("VoteIndexer")

// Conway era start slots — skip all blocks before these (no governance votes exist yet)
private val CONWAY_SLOTS = mapOf(
    "mainnet" to 133_660_800L,   // epoch 507
    "preprod" to  68_774_400L,   // epoch 163
)

// Slots per epoch for rough epoch estimation from slot number
private val SLOTS_PER_EPOCH = mapOf("mainnet" to 432_000L, "preprod" to 86_400L)

// How many nextBlock requests to pipeline ahead (reduces round-trip overhead)
private const val PIPELINE_SIZE = 200

private val wsClient = HttpClient(CIO) {
    install(WebSockets)
}

/**
 * Start the chain-sync vote indexer for [network].
 *
 * This Ogmios deployment does not support `findIntersect`, so we always start
 * from the genesis block and advance forward.  Pre-Conway blocks are skipped
 * without any DB I/O.  Conway blocks are scanned for `votingProcedures` and
 * any DRep votes are upserted into [DrepVotes].
 *
 * On restart the checkpoint slot is loaded from DB so we avoid re-inserting
 * already-indexed votes (the UPSERT is idempotent, but the DB round-trips add
 * latency).  Even with a checkpoint, we must still stream all blocks from
 * genesis — the checkpoint only suppresses duplicate DB writes.
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
                // Prime the pipeline with PIPELINE_SIZE requests upfront
                var inFlight = 0L
                repeat(PIPELINE_SIZE) {
                    sendNextBlock(inFlight++)
                }

                var lastCheckpointMs = System.currentTimeMillis()
                var blocksProcessed  = 0L
                var votesInserted    = 0L

                for (frame in incoming) {
                    if (frame !is Frame.Text) continue
                    val msg = parseJson(frame.readText()) ?: run {
                        sendNextBlock(inFlight++)  // keep pipeline filled
                        continue
                    }

                    val result = msg["result"]?.jsonObject
                    if (result == null) {
                        sendNextBlock(inFlight++)
                        continue
                    }

                    val direction = result["direction"]?.jsonPrimitive?.contentOrNull
                    if (direction == "backward") {
                        // Ogmios reset to genesis — normal on first connection
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

                    // ── Conway era: parse for governance votes ──────────────
                    if (slot >= conwayStartSlot) {
                        val checkpointSlot = checkpoint?.first ?: 0L

                        // If we already indexed past this slot, skip the DB write
                        // (UPSERT would be idempotent but expensive during catchup)
                        if (slot > checkpointSlot) {
                            val txs = block["transactions"]?.jsonArray ?: JsonArray(emptyList())
                            for (tx in txs) {
                                val txObj = runCatching { tx.jsonObject }.getOrNull() ?: continue
                                val txHash = txObj["id"]?.jsonPrimitive?.contentOrNull ?: continue
                                val votes  = txObj["votes"]?.jsonArray ?: continue
                                for (vp in votes) {
                                    if (indexVote(network, slot, slotsPerEpoch, txHash, vp.jsonObject)) {
                                        votesInserted++
                                    }
                                }
                            }
                        }

                        // Checkpoint every 60 s once we're in Conway territory
                        val now = System.currentTimeMillis()
                        if (now - lastCheckpointMs >= 60_000 && blockHash.isNotEmpty()) {
                            saveCheckpoint(network, slot, blockHash)
                            lastCheckpointMs = now
                            logger.info { "VoteIndexer [$network] slot=$slot blocks=$blocksProcessed votes=$votesInserted" }
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

// ── DB helpers ───────────────────────────────────────────────────────────────

private fun indexVote(
    network: String,
    slot: Long,
    slotsPerEpoch: Long,
    txHash: String,
    vp: JsonObject,
): Boolean {
    val voter = vp["voter"]?.jsonObject ?: return false
    if (voter["role"]?.jsonPrimitive?.contentOrNull != "delegateRepresentative") return false

    val voterId = voter["id"]?.jsonPrimitive?.contentOrNull ?: return false
    val credentialHex = runCatching { drepIdToCredentialHex(voterId) }.getOrElse { voterId }
    if (credentialHex.length != 56) return false

    val actionId = vp["actionId"]?.jsonObject ?: return false
    val proposalTxHash = actionId["transaction"]?.jsonObject?.get("id")
        ?.jsonPrimitive?.contentOrNull ?: return false
    val proposalIndex = actionId["index"]?.jsonPrimitive?.intOrNull ?: 0
    val vote = vp["vote"]?.jsonPrimitive?.contentOrNull ?: return false

    val epoch = (slot / slotsPerEpoch).toInt()

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
            }
        }
        true
    } catch (_: Exception) { false }
}

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

// ── WebSocket helpers ────────────────────────────────────────────────────────

private var reqId = 0L

private suspend fun DefaultClientWebSocketSession.sendNextBlock(id: Long) =
    send(Frame.Text("""{"jsonrpc":"2.0","method":"nextBlock","params":{},"id":$id}"""))

private fun parseJson(text: String): JsonObject? =
    runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull()
