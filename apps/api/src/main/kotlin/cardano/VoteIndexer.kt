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

// Conway era start points — chain-sync must begin at or before these slots.
// Both networks: we intersect at the slot just before Conway so we catch
// every governance vote from the very first Conway block.
private val CONWAY_STARTS = mapOf(
    "mainnet" to (133_660_800L to "genesis"),  // epoch 507
    "preprod" to (68_774_400L  to "genesis"),  // epoch 163
)

private val wsClient = HttpClient(CIO) {
    install(WebSockets)
}

/**
 * Start the chain-sync indexer for a given network.
 * Resumes from the last checkpoint; on first run uses the Conway era start slot.
 *
 * The indexer streams blocks from Ogmios WebSocket, extracts votingProcedures,
 * and upserts them into [DrepVotes].  It saves a checkpoint every 1000 blocks
 * so restarts are cheap.
 */
suspend fun runVoteIndexer(network: String, ogmiosUrl: String) {
    val wsUrl = ogmiosUrl
        .replace("https://", "wss://")
        .replace("http://",  "ws://")

    while (true) {
        try {
            logger.info { "VoteIndexer [$network] connecting to $wsUrl" }
            wsClient.webSocket(wsUrl) {
                // 1. Find the right intersection
                val checkpoint = loadCheckpoint(network)
                val intersectPoint = buildIntersectPoint(checkpoint, network)
                sendText(intersectPoint)
                val intersectReply = receiveText()
                val intersectOk = parseJson(intersectReply)
                    ?.get("result")?.jsonObject?.containsKey("intersection") == true
                if (!intersectOk) {
                    logger.warn { "VoteIndexer [$network] findIntersect failed: $intersectReply" }
                    return@webSocket
                }
                logger.info { "VoteIndexer [$network] intersection established, syncing…" }

                // 2. Pump blocks
                val conwayStartSlot = CONWAY_STARTS[network]?.first ?: 0L
                var lastCheckpointMs = System.currentTimeMillis()
                var requestId = 1L
                var processedBlocks = 0L

                while (true) {
                    sendText(buildNextBlock(requestId++))
                    val raw = receiveText()
                    val msg = parseJson(raw) ?: continue
                    val result = msg["result"]?.jsonObject ?: continue
                    val direction = result["direction"]?.jsonPrimitive?.contentOrNull
                    if (direction == "backward") continue   // rollback — just resume forward

                    val block = result["block"]?.jsonObject ?: continue
                    val slot = block["slot"]?.jsonPrimitive?.longOrNull ?: continue
                    val blockHash = block["id"]?.jsonPrimitive?.contentOrNull ?: continue

                    processedBlocks++

                    // Skip pre-Conway blocks — no governance votes exist before Conway era
                    if (slot >= conwayStartSlot) {
                        val txs = block["transactions"]?.jsonArray ?: JsonArray(emptyList())
                        for (tx in txs) {
                            val txObj = tx.jsonObject
                            val txHash = txObj["id"]?.jsonPrimitive?.contentOrNull ?: continue
                            val votingProcs = txObj["votes"]?.jsonArray ?: continue
                            for (vp in votingProcs) {
                                indexVote(network, slot, txHash, vp.jsonObject)
                            }
                        }
                    }

                    // Checkpoint every 60s (not per-block count — avoids DB pressure during catchup)
                    val now = System.currentTimeMillis()
                    if (now - lastCheckpointMs >= 60_000) {
                        saveCheckpoint(network, slot, blockHash)
                        lastCheckpointMs = now
                        logger.debug { "VoteIndexer [$network] at slot $slot (${processedBlocks} blocks processed)" }
                    }
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            logger.warn { "VoteIndexer [$network] disconnected (${e.message}), retrying in 30s" }
            delay(30_000)
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private fun indexVote(network: String, slot: Long, txHash: String, vp: JsonObject) {
    val voter = vp["voter"]?.jsonObject ?: return
    val role = voter["role"]?.jsonPrimitive?.contentOrNull ?: return
    if (role != "delegateRepresentative") return

    val voterId = voter["id"]?.jsonPrimitive?.contentOrNull ?: return
    val credentialHex = runCatching { drepIdToCredentialHex(voterId) }.getOrElse { voterId }
    if (credentialHex.length != 56) return  // not a valid 28-byte credential

    val actionId = vp["actionId"]?.jsonObject ?: return
    val proposalTxHash = actionId["transaction"]?.jsonObject?.get("id")
        ?.jsonPrimitive?.contentOrNull ?: return
    val proposalIndex = actionId["index"]?.jsonPrimitive?.intOrNull ?: 0
    val vote = vp["vote"]?.jsonPrimitive?.contentOrNull ?: return

    // epoch ≈ slot / slotsPerEpoch (432000 mainnet, 86400 preprod)
    val slotsPerEpoch = if (network == "mainnet") 432_000L else 86_400L
    val epoch = (slot / slotsPerEpoch).toInt()

    try {
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
    } catch (_: Exception) {}
}

private fun loadCheckpoint(network: String): Pair<Long, String>? =
    try {
        transaction {
            IndexerCheckpoint.selectAll()
                .where { IndexerCheckpoint.network eq network }
                .singleOrNull()
                ?.let {
                    it[IndexerCheckpoint.slot] to it[IndexerCheckpoint.blockHash]
                }
        }
    } catch (_: Exception) { null }

private fun saveCheckpoint(network: String, slot: Long, blockHash: String) {
    try {
        transaction {
            IndexerCheckpoint.upsert(IndexerCheckpoint.network) {
                it[IndexerCheckpoint.network]   = network
                it[IndexerCheckpoint.slot]      = slot
                it[IndexerCheckpoint.blockHash] = blockHash
            }
        }
    } catch (_: Exception) {}
}

private fun buildIntersectPoint(checkpoint: Pair<Long, String>?, network: String): String {
    // If we have a real checkpoint (slot + hash), resume from there.
    // Otherwise start from "origin" — Ogmios 6.x accepts the string "origin" as a special
    // point meaning the genesis block. Pre-Conway blocks have no votes so skipping them
    // is free (just slot/hash reads, no DB writes).
    val points: JsonArray = if (checkpoint != null) {
        JsonArray(listOf(buildJsonObject {
            put("slot", checkpoint.first)
            put("id",   checkpoint.second)
        }))
    } else {
        JsonArray(listOf(JsonPrimitive("origin")))
    }
    return buildJsonObject {
        put("jsonrpc", "2.0")
        put("method",  "findIntersect")
        put("params",  buildJsonObject { put("points", points) })
        put("id",      "intersect")
    }.toString()
}

private fun buildNextBlock(id: Long) = buildJsonObject {
    put("jsonrpc", "2.0")
    put("method",  "nextBlock")
    put("params",  buildJsonObject {})
    put("id",      id)
}.toString()

private suspend fun DefaultClientWebSocketSession.sendText(text: String) =
    send(Frame.Text(text))

private suspend fun DefaultClientWebSocketSession.receiveText(): String {
    for (frame in incoming) {
        if (frame is Frame.Text) return frame.readText()
    }
    return ""
}

private fun parseJson(text: String): JsonObject? =
    runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull()
