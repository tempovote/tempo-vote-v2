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
import vote.tempo.db.IdxGovernanceProposals
import vote.tempo.db.IdxPoolMetadata
import vote.tempo.db.IndexerCheckpoint

private val logger = KotlinLogging.logger("VoteIndexer")

// Conway era start slots — skip all blocks before these
private val CONWAY_SLOTS = mapOf(
    "mainnet" to 133_660_800L,
    "preprod" to  68_774_400L,
)

private val SLOTS_PER_EPOCH = mapOf("mainnet" to 432_000L, "preprod" to 86_400L)

// govActionLifetime: number of epochs a proposal remains active before expiring.
// This is a protocol parameter (Ogmios key: governanceActionLifetime).
// Hardcoded per network — update if protocol params change via HF.
private val GOV_ACTION_LIFETIME = mapOf("mainnet" to 6, "preprod" to 6)

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
 * When a valid checkpoint exists, uses findIntersect to skip directly to the checkpoint
 * so restarts don't need to re-stream the entire pre-checkpoint chain.
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

                // Send findIntersect before the nextBlock pipeline when we have a valid checkpoint.
                // This tells Ogmios to start streaming from that point instead of genesis,
                // making restarts O(new blocks) rather than O(entire chain).
                // A "reset" checkpoint (all-zero hash) is skipped — let Ogmios stream from genesis.
                val validCheckpoint = checkpoint?.takeIf { (_, hash) ->
                    hash.length == 64 && hash.any { it != '0' }
                }
                if (validCheckpoint != null) {
                    val (cpSlot, cpHash) = validCheckpoint
                    send(Frame.Text(
                        """{"jsonrpc":"2.0","method":"findIntersect","params":{"points":[{"slot":$cpSlot,"id":"$cpHash"}]},"id":-1}"""
                    ))
                    logger.info { "VoteIndexer [$network] findIntersect requested at slot=$cpSlot" }
                }

                repeat(PIPELINE_SIZE) { sendNextBlock(inFlight++) }

                var lastCheckpointMs    = System.currentTimeMillis()
                var blocksProcessed    = 0L
                var votesInserted      = 0L
                var delegsInserted     = 0L
                var poolsInserted      = 0L
                var proposalsInserted  = 0L

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

                                // Governance proposal submissions (proposalProcedures)
                                val proposals = txObj["proposals"]?.jsonArray ?: JsonArray(emptyList())
                                for ((propIdx, propEl) in proposals.withIndex()) {
                                    val propObj = runCatching { propEl.jsonObject }.getOrNull() ?: continue
                                    if (indexProposal(network, slot, epoch, txHash, propIdx, propObj))
                                        proposalsInserted++
                                }

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
                                "proposals=$proposalsInserted votes=$votesInserted " +
                                "delegs=$delegsInserted pools=$poolsInserted"
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
    // Ogmios 6.x chain-sync uses "issuer" (same as queryLedgerState/governanceProposals).
    val issuer = vp["issuer"]?.jsonObject ?: return false
    val role   = issuer["role"]?.jsonPrimitive?.contentOrNull ?: return false

    // Map all three voter roles to a credential hex + short role tag
    val (credentialHex, voterRole) = when (role) {
        "delegateRepresentative" -> {
            val id = issuer["id"]?.jsonPrimitive?.contentOrNull ?: return false
            val hex = runCatching { drepIdToCredentialHex(id) }.getOrElse { id }
                .takeIf { it.length == 56 } ?: return false
            hex to "drep"
        }
        "constitutionalCommitteeMember" -> {
            val hex = issuer["id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.length == 56 } ?: return false
            hex to "cc"
        }
        "stakePoolOperator" -> {
            val id = issuer["id"]?.jsonPrimitive?.contentOrNull ?: return false
            id to "spo"
        }
        else -> return false  // ignore genesisDelegate and other legacy roles
    }

    val actionId       = vp["actionId"]?.jsonObject ?: return false
    val proposalTxHash = actionId["transaction"]?.jsonObject?.get("id")
        ?.jsonPrimitive?.contentOrNull ?: return false
    val proposalIndex  = actionId["index"]?.jsonPrimitive?.intOrNull ?: 0
    val vote           = vp["vote"]?.jsonPrimitive?.contentOrNull ?: return false
    val anchor     = vp["anchor"]?.jsonObject
    val anchorUrl  = anchor?.get("url")?.jsonPrimitive?.contentOrNull
    val anchorHash = anchor?.get("hash")?.jsonPrimitive?.contentOrNull

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
                it[DrepVotes.voterRole]         = voterRole
                it[DrepVotes.txHash]            = txHash
                it[DrepVotes.proposalTxHash]    = proposalTxHash
                it[DrepVotes.proposalIndex]     = proposalIndex
                it[DrepVotes.vote]              = vote
                it[DrepVotes.epoch]             = epoch
                it[DrepVotes.slot]              = slot
                if (anchorUrl  != null) it[DrepVotes.anchorUrl]  = anchorUrl
                if (anchorHash != null) it[DrepVotes.anchorHash] = anchorHash
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
    // Ogmios 6.x cert formats for Conway vote delegation:
    //   voteDelegation, stakeVoteDelegation, voteRegistrationDelegation, stakeVoteRegistrationDelegation
    //
    // Credential: may be a plain hex string OR an object {type, keyHash/scriptHash}.
    val stakeHex: String = when (val credEl = cert["credential"]) {
        is JsonObject    -> credEl["keyHash"]?.jsonPrimitive?.contentOrNull
                            ?: credEl["scriptHash"]?.jsonPrimitive?.contentOrNull
                            ?: return false
        is JsonPrimitive -> credEl.contentOrNull ?: return false
        else             -> {
            logger.debug { "indexDelegationCert: unknown credential format — ${cert.toString().take(200)}" }
            return false
        }
    }

    val delegatee     = cert["delegatee"]?.jsonObject ?: run {
        logger.debug { "indexDelegationCert: missing delegatee — ${cert.toString().take(200)}" }
        return false
    }
    val delegateeType = delegatee["type"]?.jsonPrimitive?.contentOrNull ?: return false

    // Ogmios 6.x delegatee types:
    //   keyHash / scriptHash       → specific DRep (credential inline or under "drep")
    //   abstain / alwaysAbstain    → predefined abstain
    //   noConfidence / alwaysNoConfidence → predefined no-confidence
    val (drepType, drepHex) = when (delegateeType) {
        "keyHash"             -> "key"          to delegatee["keyHash"]?.jsonPrimitive?.contentOrNull
        "scriptHash"          -> "script"       to delegatee["scriptHash"]?.jsonPrimitive?.contentOrNull
        "drep" -> {
            // Nested format: {"type":"drep", "drep": {"type":"keyHash","keyHash":"..."}}
            val inner = delegatee["drep"]?.jsonObject
            val hex   = inner?.get("keyHash")?.jsonPrimitive?.contentOrNull
                        ?: inner?.get("scriptHash")?.jsonPrimitive?.contentOrNull
                        ?: delegatee["id"]?.jsonPrimitive?.contentOrNull
            val t = if (inner?.get("type")?.jsonPrimitive?.contentOrNull == "scriptHash") "script" else "key"
            t to hex
        }
        "abstain", "alwaysAbstain"           -> "abstain"       to null
        "noConfidence", "alwaysNoConfidence" -> "no_confidence" to null
        else -> {
            logger.debug { "indexDelegationCert: unknown delegatee type '$delegateeType' — ${cert.toString().take(200)}" }
            return false
        }
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
    // Ogmios 6.x format: certificates[].stakePool.id (bech32) + .metadata.url
    val stakePool   = cert["stakePool"]?.jsonObject ?: return false
    val poolBech32  = stakePool["id"]?.jsonPrimitive?.contentOrNull ?: return false
    val metadataUrl = stakePool["metadata"]?.jsonObject?.get("url")
        ?.jsonPrimitive?.contentOrNull

    // Pool ID hex: decode bech32 → skip for now; store empty, update after name fetch
    val poolHex = runCatching { bech32ToHex(poolBech32) }.getOrElse { "" }
        .takeIf { it.length == 56 } ?: poolBech32  // fallback: use bech32 as key

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

// ── Proposal procedure indexing ───────────────────────────────────────────────

/**
 * Index a governance proposal procedure from a Conway-era transaction.
 * tx.proposals[] in Ogmios 6.x chain-sync: each element has action, metadata, deposit, returnAddress.
 * proposalIndex = position of this proposal in the tx.proposals array (0-based) — forms the on-chain proposal ID.
 * expiresEpoch = submittedEpoch + govActionLifetime (protocol param, 6 epochs on mainnet/preprod).
 */
private fun indexProposal(
    network: String,
    slot: Long,
    epoch: Int,
    txHash: String,
    proposalIndex: Int,
    proposal: JsonObject,
): Boolean {
    val action     = proposal["action"]?.jsonObject ?: return false
    val actionType = action["type"]?.jsonPrimitive?.contentOrNull ?: return false

    val metadata   = proposal["metadata"]?.jsonObject
    val anchorUrl  = metadata?.get("url")?.jsonPrimitive?.contentOrNull
    val anchorHash = metadata?.get("hash")?.jsonPrimitive?.contentOrNull

    val deposit       = proposal["deposit"]?.jsonObject?.let { extractLovelace(it) } ?: 0L
    val returnAddress = proposal["returnAddress"]?.jsonPrimitive?.contentOrNull

    val govActionLifetime = GOV_ACTION_LIFETIME[network] ?: 6
    val expiresEpoch      = epoch + govActionLifetime
    val actionDetailsJson = action.toString()   // raw Ogmios action body — parsed at serve time

    return try {
        transaction {
            IdxGovernanceProposals.upsert(
                IdxGovernanceProposals.network,
                IdxGovernanceProposals.txHash,
                IdxGovernanceProposals.index,
            ) {
                it[IdxGovernanceProposals.network]        = network
                it[IdxGovernanceProposals.txHash]         = txHash
                it[IdxGovernanceProposals.index]          = proposalIndex
                it[IdxGovernanceProposals.actionType]     = actionType
                it[IdxGovernanceProposals.anchorUrl]      = anchorUrl
                it[IdxGovernanceProposals.anchorHash]     = anchorHash
                it[IdxGovernanceProposals.deposit]        = deposit
                it[IdxGovernanceProposals.submittedSlot]  = slot
                it[IdxGovernanceProposals.submittedEpoch] = epoch
                it[IdxGovernanceProposals.expiresEpoch]   = expiresEpoch
                it[IdxGovernanceProposals.actionDetails]  = actionDetailsJson
                it[IdxGovernanceProposals.returnAddress]  = returnAddress
            }
        }
        true
    } catch (e: Exception) {
        logger.warn { "indexProposal failed for $txHash#$proposalIndex [$network]: ${e.message}" }
        false
    }
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
