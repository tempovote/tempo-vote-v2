package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.datetime.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.cardano.AllianceScripts
import vote.tempo.cardano.FinalizationTxSubmitter
import vote.tempo.cardano.Network
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.cardano.networkFromString
import vote.tempo.cache.CardanoCache
import vote.tempo.db.Alliances
import vote.tempo.db.AllianceMembers
import vote.tempo.db.AllianceProposals
import vote.tempo.db.AllianceProposalVotes
import vote.tempo.db.DrepMetadata
import vote.tempo.plugins.ApiError
import java.util.UUID
import kotlin.time.Duration.Companion.hours

private fun requireUuid(str: String?, name: String): UUID? =
    str?.let { runCatching { UUID.fromString(it) }.getOrNull() }

// ─── DTOs ─────────────────────────────────────────────────────────────────────

@Serializable
data class ProposalTally(
    val yesVp: Long,
    val noVp: Long,
    val abstainVp: Long,
    val yesCount: Int,
    val noCount: Int,
    val abstainCount: Int,
    val totalVoted: Int,
    val totalMembers: Int,
    val isQuorumMet: Boolean,
    val isApproved: Boolean,
)

@Serializable
data class ProposalItem(
    val id: String,
    val allianceId: String,
    val proposerDrepId: String,
    val proposerName: String? = null,
    val proposalType: String,
    val title: String,
    val description: String?,
    val amountLovelace: Long? = null,
    val recipientAddress: String? = null,
    val recipientLabel: String? = null,
    val govActionTxHash: String? = null,
    val govActionIndex: Int? = null,
    val status: String,
    val votingEndsAt: String,
    val approvedAt: String? = null,
    val executableAt: String? = null,
    val executedTxHash: String? = null,
    val finalizationTxHash: String? = null,
    val finalizationTxIndex: Int? = null,
    val createdAt: String,
    val tally: ProposalTally,
    val myVote: String? = null,
)

@Serializable
data class ProposalListResponse(
    val items: List<ProposalItem>,
    val total: Int,
    val page: Int,
    val limit: Int,
)

@Serializable
data class CreateProposalRequest(
    val proposalType: String,
    val title: String,
    val description: String? = null,
    val amountLovelace: Long? = null,
    val recipientAddress: String? = null,
    val recipientLabel: String? = null,
    val govActionTxHash: String? = null,
    val govActionIndex: Int? = null,
)

@Serializable
data class CastAllianceVoteRequest(
    val vote: String,
)

@Serializable
data class MarkExecutedRequest(
    val txHash: String,
)

@Serializable
data class TreasuryUtxoItem(
    val txHash: String,
    val outputIndex: Int,
    val lovelace: Long,
)

@Serializable
data class TreasuryBalanceResponse(
    val treasuryAddress: String,
    val balanceLovelace: Long,
    val utxos: List<TreasuryUtxoItem>,
    // Real contribution transactions (spent or unspent), reconstructed from on-chain history.
    // Distinct from `utxos` (current state) — withdrawal change-back outputs are excluded here.
    val contributions: List<TreasuryUtxoItem> = emptyList(),
)

@Serializable
data class AllianceStanceItem(
    val allianceId: String,
    val allianceName: String,
    val allianceLogoUrl: String?,
    val proposalId: String,
    val stance: String,
    val yesCount: Int,
    val noCount: Int,
    val abstainCount: Int,
    val totalVoted: Int,
    val memberCount: Int,
    val status: String,
    val votingEndsAt: String,
)

// ─── Tally ────────────────────────────────────────────────────────────────────

private fun computeTally(
    proposalId: UUID,
    totalMembers: Int,
    vpCapPct: Int,
    quorumThreshold: Int,
    approvalThresholdVp: Int,
    approvalThresholdCount: Int,
): ProposalTally {
    data class VoteRow(val vote: String, val vp: Long)

    val rows = transaction {
        AllianceProposalVotes.selectAll()
            .where { AllianceProposalVotes.proposalId eq proposalId }
            .map { VoteRow(it[AllianceProposalVotes.vote], it[AllianceProposalVotes.votingPower]) }
    }

    if (rows.isEmpty()) {
        return ProposalTally(0, 0, 0, 0, 0, 0, 0, totalMembers, false, false)
    }

    val totalRawVp = rows.sumOf { it.vp }
    val vpCapLovelace = if (vpCapPct in 1..100) totalRawVp * vpCapPct / 100 else Long.MAX_VALUE

    var yesVp = 0L; var noVp = 0L; var abstainVp = 0L
    var yesCount = 0; var noCount = 0; var abstainCount = 0

    for (r in rows) {
        val effectiveVp = if (vpCapLovelace > 0) minOf(r.vp, vpCapLovelace) else r.vp
        when (r.vote) {
            "YES"     -> { yesVp += effectiveVp; yesCount++ }
            "NO"      -> { noVp += effectiveVp; noCount++ }
            "ABSTAIN" -> { abstainVp += effectiveVp; abstainCount++ }
        }
    }

    val totalVoted = rows.size
    val votedVp    = yesVp + noVp + abstainVp

    // Quorum: % of members must have voted (headcount-based for Phase 2)
    val isQuorumMet = totalMembers == 0 ||
        (totalVoted * 100 / totalMembers) >= quorumThreshold

    val vpOk  = votedVp > 0 && (yesVp * 100 / votedVp) >= approvalThresholdVp
    val cntOk = totalVoted > 0 && (yesCount * 100 / totalVoted) >= approvalThresholdCount
    val isApproved = isQuorumMet && vpOk && cntOk

    return ProposalTally(yesVp, noVp, abstainVp, yesCount, noCount, abstainCount,
        totalVoted, totalMembers, isQuorumMet, isApproved)
}

// ─── VP lookup from CardanoCache ──────────────────────────────────────────────

private fun lookupDrepVp(drepId: String, network: Network): Long {
    val credHex = runCatching { drepIdToCredentialHex(drepId) }.getOrNull() ?: return 0L
    val listRaw = CardanoCache.drepList.getIfPresent(network.name) ?: return 0L

    val drepsArray: JsonArray = when {
        listRaw is JsonArray -> listRaw
        listRaw is JsonObject && listRaw["delegateRepresentatives"] is JsonArray ->
            listRaw["delegateRepresentatives"]!!.jsonArray
        else -> return 0L
    }

    val entry = drepsArray
        .mapNotNull { runCatching { it.jsonObject }.getOrNull() }
        .firstOrNull { e ->
            if (e["type"]?.jsonPrimitive?.contentOrNull != "registered") return@firstOrNull false
            val id = e["id"]?.jsonPrimitive?.contentOrNull ?: return@firstOrNull false
            id == drepId || id == credHex ||
                (id.startsWith("drep") && runCatching { drepIdToCredentialHex(id) }.getOrNull() == credHex)
        } ?: return 0L

    val stake = entry["stake"] ?: return 0L
    return when {
        stake is JsonPrimitive -> stake.longOrNull ?: 0L
        stake is JsonObject    ->
            stake["ada"]?.jsonObject?.get("lovelace")?.jsonPrimitive?.longOrNull
                ?: stake["lovelace"]?.jsonPrimitive?.longOrNull ?: 0L
        else -> 0L
    }
}

// ─── Row → ProposalItem ───────────────────────────────────────────────────────

private fun rowToProposalItem(
    row: ResultRow,
    tally: ProposalTally,
    myVote: String?,
    proposerName: String?,
): ProposalItem = ProposalItem(
    id               = row[AllianceProposals.id].toString(),
    allianceId       = row[AllianceProposals.allianceId].toString(),
    proposerDrepId   = row[AllianceProposals.proposerDrepId],
    proposerName     = proposerName,
    proposalType     = row[AllianceProposals.proposalType],
    title            = row[AllianceProposals.title],
    description      = row[AllianceProposals.description],
    amountLovelace   = row[AllianceProposals.amountLovelace],
    recipientAddress = row[AllianceProposals.recipientAddress],
    recipientLabel   = row[AllianceProposals.recipientLabel],
    govActionTxHash  = row[AllianceProposals.govActionTxHash],
    govActionIndex   = row[AllianceProposals.govActionIndex],
    status           = row[AllianceProposals.status],
    votingEndsAt     = row[AllianceProposals.votingEndsAt].toString(),
    approvedAt       = row[AllianceProposals.approvedAt]?.toString(),
    executableAt          = row[AllianceProposals.executableAt]?.toString(),
    executedTxHash        = row[AllianceProposals.executedTxHash],
    finalizationTxHash    = row[AllianceProposals.finalizationTxHash],
    finalizationTxIndex   = if (row[AllianceProposals.finalizationTxHash] != null) 0 else null,
    createdAt        = row[AllianceProposals.createdAt].toString(),
    tally            = tally,
    myVote           = myVote,
)

// ─── Auto-close expired proposals (called by BackgroundPoller every 5 min) ───

fun autoCloseExpiredProposals() {
    val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)

    val expired = transaction {
        AllianceProposals.selectAll()
            .where {
                (AllianceProposals.status eq "voting") and
                (AllianceProposals.votingEndsAt lessEq now)
            }
            .toList()
    }

    for (row in expired) {
        val proposalId   = row[AllianceProposals.id]
        val allianceId   = row[AllianceProposals.allianceId]
        val proposalType = row[AllianceProposals.proposalType]

        val allianceRow = transaction {
            Alliances.selectAll().where { Alliances.id eq allianceId }.firstOrNull()
        } ?: continue

        val votingEndsAt = row[AllianceProposals.votingEndsAt]
        val memberCount = transaction {
            AllianceMembers.selectAll()
                .where {
                    (AllianceMembers.allianceId eq allianceId) and
                    (AllianceMembers.joinedAt lessEq votingEndsAt)
                }
                .count().toInt()
        }

        val tally = computeTally(
            proposalId             = proposalId,
            totalMembers           = memberCount,
            vpCapPct               = allianceRow[Alliances.vpCapPct],
            quorumThreshold        = allianceRow[Alliances.quorumThreshold],
            approvalThresholdVp    = allianceRow[Alliances.approvalThresholdVp],
            approvalThresholdCount = allianceRow[Alliances.approvalThresholdCount],
        )

        val newStatus = when {
            proposalType == "withdrawal" && tally.isApproved -> "approved_pending"
            tally.isApproved                                 -> "passed"
            proposalType == "withdrawal"                     -> "rejected"
            else                                             -> "failed"
        }

        transaction {
            AllianceProposals.update({ AllianceProposals.id eq proposalId }) {
                it[status] = newStatus
                if (newStatus == "approved_pending") {
                    val approvedNow = Clock.System.now()
                    it[approvedAt]   = approvedNow.toLocalDateTime(TimeZone.UTC)
                    it[executableAt] = (approvedNow + allianceRow[Alliances.timelockHours].hours)
                        .toLocalDateTime(TimeZone.UTC)
                }
            }
        }
    }

    // Promote approved_pending → approved once the timelock has elapsed. This runs on EVERY
    // poll, independent of whether any proposal just expired — otherwise approved_pending
    // proposals would stay stuck (and the Execute flow couldn't mark them executed).
    transaction {
        AllianceProposals.update({
            (AllianceProposals.status eq "approved_pending") and
            (AllianceProposals.executableAt lessEq now)
        }) {
            it[status] = "approved"
        }
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

fun Route.allianceProposalRoutes() {

    // GET /governance-actions/{txHash}/{index}/alliance-stances
    get("/governance-actions/{txHash}/{index}/alliance-stances") {
        val txHash = call.parameters["txHash"]
            ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("txHash required"))
        val index = call.parameters["index"]?.toIntOrNull()
            ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("index must be integer"))

        val stances = transaction {
            AllianceProposals.selectAll()
                .where {
                    (AllianceProposals.proposalType eq "ga_stance") and
                    (AllianceProposals.govActionTxHash eq txHash) and
                    (AllianceProposals.govActionIndex eq index) and
                    (AllianceProposals.status neq "cancelled")
                }
                .toList()
                .mapNotNull { row ->
                    val allianceId = row[AllianceProposals.allianceId]
                    val allianceRow = Alliances.selectAll()
                        .where { Alliances.id eq allianceId }
                        .firstOrNull() ?: return@mapNotNull null

                    val proposalId = row[AllianceProposals.id]
                    val proposalVotingEndsAt = row[AllianceProposals.votingEndsAt]
                    val memberCount = AllianceMembers.selectAll()
                        .where {
                            (AllianceMembers.allianceId eq allianceId) and
                            (AllianceMembers.joinedAt lessEq proposalVotingEndsAt)
                        }
                        .count().toInt()

                    val votes = AllianceProposalVotes.selectAll()
                        .where { AllianceProposalVotes.proposalId eq proposalId }
                        .toList()

                    val yesCount     = votes.count { it[AllianceProposalVotes.vote] == "YES" }
                    val noCount      = votes.count { it[AllianceProposalVotes.vote] == "NO" }
                    val abstainCount = votes.count { it[AllianceProposalVotes.vote] == "ABSTAIN" }
                    val stance = when {
                        yesCount >= noCount && yesCount >= abstainCount -> "YES"
                        noCount >= abstainCount -> "NO"
                        else -> "ABSTAIN"
                    }

                    AllianceStanceItem(
                        allianceId      = allianceId.toString(),
                        allianceName    = allianceRow[Alliances.name],
                        allianceLogoUrl = allianceRow[Alliances.logoUrl],
                        proposalId      = proposalId.toString(),
                        stance          = stance,
                        yesCount        = yesCount,
                        noCount         = noCount,
                        abstainCount    = abstainCount,
                        totalVoted      = votes.size,
                        memberCount     = memberCount,
                        status          = row[AllianceProposals.status],
                        votingEndsAt    = row[AllianceProposals.votingEndsAt].toString(),
                    )
                }
        }

        call.respond(stances)
    }

    route("/alliances/{id}/proposals") {

        // GET /alliances/:id/proposals?type=withdrawal|ga_stance&page=1&status=voting
        get {
            val allianceId = requireUuid(call.parameters["id"], "id")
                ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
            val typeFilter   = call.request.queryParameters["type"]
            val statusFilter = call.request.queryParameters["status"]
            val callerDrepId = call.request.queryParameters["drepId"]
            val page  = (call.request.queryParameters["page"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
            val limit = 20
            val offset = ((page - 1) * limit).toLong()

            val allianceRow = transaction {
                Alliances.selectAll().where { Alliances.id eq allianceId }.firstOrNull()
            } ?: return@get call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))

            val (items, total) = transaction {
                var query = AllianceProposals.selectAll()
                    .where { AllianceProposals.allianceId eq allianceId }

                if (typeFilter != null)   query = query.andWhere { AllianceProposals.proposalType eq typeFilter }
                if (statusFilter != null) query = query.andWhere { AllianceProposals.status eq statusFilter }

                val total = query.count().toInt()
                val rows  = query.orderBy(AllianceProposals.createdAt, SortOrder.DESC)
                    .limit(limit).offset(offset).toList()

                val items = rows.map { row ->
                    val pid = row[AllianceProposals.id]
                    val rowVotingEndsAt = row[AllianceProposals.votingEndsAt]
                    val memberCount = AllianceMembers.selectAll()
                        .where {
                            (AllianceMembers.allianceId eq allianceId) and
                            (AllianceMembers.joinedAt lessEq rowVotingEndsAt)
                        }
                        .count().toInt()
                    val tally = computeTally(pid, memberCount,
                        allianceRow[Alliances.vpCapPct], allianceRow[Alliances.quorumThreshold],
                        allianceRow[Alliances.approvalThresholdVp], allianceRow[Alliances.approvalThresholdCount])
                    val myVote = callerDrepId?.let { did ->
                        AllianceProposalVotes.selectAll()
                            .where { (AllianceProposalVotes.proposalId eq pid) and (AllianceProposalVotes.drepId eq did) }
                            .firstOrNull()?.get(AllianceProposalVotes.vote)
                    }
                    val network = allianceRow[Alliances.network]
                    val proposerCredHex = runCatching { drepIdToCredentialHex(row[AllianceProposals.proposerDrepId]) }.getOrNull()
                    val proposerName = proposerCredHex?.let {
                        DrepMetadata.selectAll()
                            .where { (DrepMetadata.network eq network) and (DrepMetadata.credHex eq it) }
                            .firstOrNull()?.get(DrepMetadata.name)
                    }
                    rowToProposalItem(row, tally, myVote, proposerName)
                }
                items to total
            }

            call.respond(ProposalListResponse(items, total, page, limit))
        }

        // GET /alliances/:id/proposals/:pid?drepId=...
        get("/{pid}") {
            val allianceId = requireUuid(call.parameters["id"], "id")
                ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
            val pid = requireUuid(call.parameters["pid"], "pid")
                ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("Invalid proposal id"))
            val callerDrepId = call.request.queryParameters["drepId"]

            val result = transaction {
                val allianceRow = Alliances.selectAll().where { Alliances.id eq allianceId }.firstOrNull()
                    ?: return@transaction null
                val row = AllianceProposals.selectAll()
                    .where { (AllianceProposals.id eq pid) and (AllianceProposals.allianceId eq allianceId) }
                    .firstOrNull() ?: return@transaction null

                val pidVotingEndsAt = row[AllianceProposals.votingEndsAt]
                val memberCount = AllianceMembers.selectAll()
                    .where {
                        (AllianceMembers.allianceId eq allianceId) and
                        (AllianceMembers.joinedAt lessEq pidVotingEndsAt)
                    }
                    .count().toInt()

                val tally = computeTally(pid, memberCount,
                    allianceRow[Alliances.vpCapPct], allianceRow[Alliances.quorumThreshold],
                    allianceRow[Alliances.approvalThresholdVp], allianceRow[Alliances.approvalThresholdCount])

                val myVote = callerDrepId?.let { did ->
                    AllianceProposalVotes.selectAll()
                        .where { (AllianceProposalVotes.proposalId eq pid) and (AllianceProposalVotes.drepId eq did) }
                        .firstOrNull()?.get(AllianceProposalVotes.vote)
                }

                val network = allianceRow[Alliances.network]
                val proposerCredHex = runCatching { drepIdToCredentialHex(row[AllianceProposals.proposerDrepId]) }.getOrNull()
                val proposerName = proposerCredHex?.let {
                    DrepMetadata.selectAll()
                        .where { (DrepMetadata.network eq network) and (DrepMetadata.credHex eq it) }
                        .firstOrNull()?.get(DrepMetadata.name)
                }

                rowToProposalItem(row, tally, myVote, proposerName)
            }

            if (result == null) call.respond(HttpStatusCode.NotFound, ApiError("Proposal not found"))
            else call.respond(result)
        }

        authenticate("jwt") {

            // POST /alliances/:id/proposals
            post {
                val principal    = call.principal<JWTPrincipal>()!!
                val jwtDrepId    = principal.payload.getClaim("drepId")?.asString()
                    ?: return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId = requireUuid(call.parameters["id"], "id")
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))

                val req = call.receive<CreateProposalRequest>()

                if (req.title.isBlank())
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("title required"))
                if (req.proposalType !in listOf("withdrawal", "ga_stance"))
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("proposalType must be 'withdrawal' or 'ga_stance'"))
                if (req.proposalType == "withdrawal") {
                    if ((req.amountLovelace ?: 0) <= 0)
                        return@post call.respond(HttpStatusCode.BadRequest, ApiError("amountLovelace required for withdrawal"))
                    if (req.recipientAddress.isNullOrBlank())
                        return@post call.respond(HttpStatusCode.BadRequest, ApiError("recipientAddress required for withdrawal"))
                }
                if (req.proposalType == "ga_stance" && (req.govActionTxHash.isNullOrBlank() || req.govActionIndex == null))
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("govActionTxHash + govActionIndex required for ga_stance"))

                val (allianceRow, membership) = transaction {
                    val a = Alliances.selectAll().where { Alliances.id eq allianceId }.firstOrNull()
                        ?: return@transaction null to null
                    val m = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId) }
                        .firstOrNull()
                    a to m
                }

                if (allianceRow == null) return@post call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))
                if (membership == null) return@post call.respond(HttpStatusCode.Forbidden, ApiError("Must be a member to create proposals"))

                val durationDays = allianceRow[Alliances.proposalDurationDays]  // Int
                val votingEndsAt = (Clock.System.now() + 24.hours * durationDays)
                    .toLocalDateTime(TimeZone.UTC)

                val newId = transaction {
                    AllianceProposals.insert {
                        it[AllianceProposals.allianceId]   = allianceId
                        it[proposerDrepId]                 = jwtDrepId
                        it[proposalType]                   = req.proposalType
                        it[title]                          = req.title.trim()
                        it[description]                    = req.description?.trim()
                        it[amountLovelace]                 = req.amountLovelace
                        it[recipientAddress]               = req.recipientAddress?.trim()
                        it[recipientLabel]                 = req.recipientLabel?.trim()
                        it[govActionTxHash]                = req.govActionTxHash?.trim()
                        it[govActionIndex]                 = req.govActionIndex
                        it[AllianceProposals.votingEndsAt] = votingEndsAt
                    }[AllianceProposals.id]
                }

                call.respond(HttpStatusCode.Created, mapOf("id" to newId.toString()))
            }

            // POST /alliances/:id/proposals/:pid/vote
            post("/{pid}/vote") {
                val principal    = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject
                val jwtDrepId    = principal.payload.getClaim("drepId")?.asString()
                    ?: return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId = requireUuid(call.parameters["id"], "id")
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
                val pid = requireUuid(call.parameters["pid"], "pid")
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid proposal id"))

                val req = call.receive<CastAllianceVoteRequest>()
                val voteChoice = req.vote.uppercase()
                if (voteChoice !in listOf("YES", "NO", "ABSTAIN"))
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("vote must be YES, NO, or ABSTAIN"))

                data class VoteContext(val network: String, val proposalStatus: String, val votingEndsAt: LocalDateTime)

                val ctx = transaction {
                    val a = Alliances.selectAll().where { Alliances.id eq allianceId }.firstOrNull()
                        ?: return@transaction null
                    val p = AllianceProposals.selectAll()
                        .where { (AllianceProposals.id eq pid) and (AllianceProposals.allianceId eq allianceId) }
                        .firstOrNull() ?: return@transaction null
                    val m = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId) }
                        .firstOrNull() ?: return@transaction null
                    VoteContext(a[Alliances.network], p[AllianceProposals.status], p[AllianceProposals.votingEndsAt])
                }

                if (ctx == null) return@post call.respond(HttpStatusCode.NotFound, ApiError("Alliance or proposal not found"))
                if (ctx.proposalStatus != "voting") return@post call.respond(HttpStatusCode.Conflict, ApiError("Proposal is not open for voting"))

                val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)
                if (now > ctx.votingEndsAt) return@post call.respond(HttpStatusCode.Conflict, ApiError("Voting period has ended"))

                val network = networkFromString(ctx.network)
                val vp = lookupDrepVp(jwtDrepId, network)

                val result = runCatching {
                    transaction {
                        val existing = AllianceProposalVotes.selectAll()
                            .where { (AllianceProposalVotes.proposalId eq pid) and (AllianceProposalVotes.drepId eq jwtDrepId) }
                            .firstOrNull()

                        if (existing != null) {
                            AllianceProposalVotes.update({
                                (AllianceProposalVotes.proposalId eq pid) and (AllianceProposalVotes.drepId eq jwtDrepId)
                            }) {
                                it[vote] = voteChoice
                                it[votingPower] = vp
                            }
                        } else {
                            AllianceProposalVotes.insert {
                                it[proposalId]                         = pid
                                it[drepId]                             = jwtDrepId
                                it[AllianceProposalVotes.stakeAddress] = stakeAddress
                                it[vote]                               = voteChoice
                                it[votingPower]                        = vp
                            }
                        }
                    }
                }

                result.fold(
                    onSuccess = { call.respond(HttpStatusCode.OK, mapOf("vote" to voteChoice)) },
                    onFailure = { e -> call.respond(HttpStatusCode.InternalServerError, ApiError(e.message ?: "Failed")) }
                )
            }

            // DELETE /alliances/:id/proposals/:pid  — Cancel (proposer or owner/admin)
            delete("/{pid}") {
                val principal = call.principal<JWTPrincipal>()!!
                val jwtDrepId = principal.payload.getClaim("drepId")?.asString()
                    ?: return@delete call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId = requireUuid(call.parameters["id"], "id")
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
                val pid = requireUuid(call.parameters["pid"], "pid")
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ApiError("Invalid proposal id"))

                val error = transaction {
                    val proposalRow = AllianceProposals.selectAll()
                        .where { (AllianceProposals.id eq pid) and (AllianceProposals.allianceId eq allianceId) }
                        .firstOrNull() ?: return@transaction "not_found"

                    val membership = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId) }
                        .firstOrNull()

                    val isProposer   = proposalRow[AllianceProposals.proposerDrepId] == jwtDrepId
                    val isOwnerAdmin = membership?.get(AllianceMembers.role) in listOf("owner", "admin")
                    if (!isProposer && !isOwnerAdmin) return@transaction "forbidden"
                    if (proposalRow[AllianceProposals.status] != "voting") return@transaction "not_cancellable"

                    AllianceProposals.update({ AllianceProposals.id eq pid }) { it[status] = "cancelled" }
                    null
                }

                when (error) {
                    null             -> call.respond(HttpStatusCode.OK, mapOf("status" to "cancelled"))
                    "not_found"      -> call.respond(HttpStatusCode.NotFound, ApiError("Proposal not found"))
                    "forbidden"      -> call.respond(HttpStatusCode.Forbidden, ApiError("Not authorized"))
                    "not_cancellable"-> call.respond(HttpStatusCode.Conflict, ApiError("Only voting proposals can be cancelled"))
                    else             -> call.respond(HttpStatusCode.InternalServerError, ApiError(error))
                }
            }

            // POST /alliances/:id/proposals/:pid/execute  — Mark withdrawal executed
            post("/{pid}/execute") {
                val principal = call.principal<JWTPrincipal>()!!
                val jwtDrepId = principal.payload.getClaim("drepId")?.asString()
                    ?: return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId = requireUuid(call.parameters["id"], "id")
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
                val pid = requireUuid(call.parameters["pid"], "pid")
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid proposal id"))

                val req = call.receive<MarkExecutedRequest>()
                if (req.txHash.isBlank())
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("txHash required"))

                val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)
                val error = transaction {
                    val membership = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId) }
                        .firstOrNull() ?: return@transaction "forbidden"
                    if (membership[AllianceMembers.role] !in listOf("owner", "admin")) return@transaction "forbidden"

                    val proposalRow = AllianceProposals.selectAll()
                        .where { (AllianceProposals.id eq pid) and (AllianceProposals.allianceId eq allianceId) }
                        .firstOrNull() ?: return@transaction "not_found"
                    if (proposalRow[AllianceProposals.proposalType] != "withdrawal") return@transaction "not_withdrawal"

                    // Drain guard: an already-executed proposal must never be marked again.
                    if (proposalRow[AllianceProposals.status] == "executed" ||
                        proposalRow[AllianceProposals.executedTxHash] != null) return@transaction "already_executed"

                    // Accept both 'approved' and 'approved_pending' (timelock elapsed). The poller
                    // promotes pending→approved only every few minutes, so a freshly-executable
                    // proposal may still read 'approved_pending' here — gate on executableAt instead.
                    val st = proposalRow[AllianceProposals.status]
                    if (st != "approved" && st != "approved_pending") return@transaction "not_approved"
                    val execAt = proposalRow[AllianceProposals.executableAt]
                    if (execAt == null || execAt > now) return@transaction "timelock_active"

                    AllianceProposals.update({ AllianceProposals.id eq pid }) {
                        it[status] = "executed"
                        it[executedTxHash] = req.txHash
                    }
                    null
                }

                when (error) {
                    null              -> call.respond(HttpStatusCode.OK, mapOf("status" to "executed"))
                    "not_found"       -> call.respond(HttpStatusCode.NotFound, ApiError("Proposal not found"))
                    "forbidden"       -> call.respond(HttpStatusCode.Forbidden, ApiError("Owner or admin required"))
                    "not_withdrawal"  -> call.respond(HttpStatusCode.BadRequest, ApiError("Only withdrawal proposals can be executed"))
                    "already_executed"-> call.respond(HttpStatusCode.Conflict, ApiError("Proposal already executed"))
                    "timelock_active" -> call.respond(HttpStatusCode.Conflict, ApiError("Timelock has not elapsed yet"))
                    "not_approved"    -> call.respond(HttpStatusCode.Conflict, ApiError("Proposal must be approved before execution"))
                    else              -> call.respond(HttpStatusCode.InternalServerError, ApiError(error))
                }
            }
        }
    }

    // ─── Treasury routes ───────────────────────────────────────────────────────

    // GET /alliances/:id/treasury — current UTxO set + total balance
    get("/alliances/{id}/treasury") {
        val allianceId = requireUuid(call.parameters["id"], "id")
            ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))

        val (allianceNetwork, treasuryAddr) = transaction {
            Alliances.selectAll().where { Alliances.id eq allianceId }
                .firstOrNull()
                ?.let { it[Alliances.network] to it[Alliances.treasuryAddress] }
        } ?: return@get call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))

        val network = networkFromString(allianceNetwork)
        val resolvedAddr = treasuryAddr ?: AllianceScripts.treasuryAddress(network)

        // Filter by datum hash so UTxOs from other alliances sharing the script address are excluded
        val expectedDatumHash = runCatching {
            FinalizationTxSubmitter.buildTreasuryDatum(allianceId).getDatumHash()
        }.getOrNull()

        val queries = vote.tempo.cardano.OgmiosStateQueries(network)
        val utxos = runCatching {
            queries.getScriptUtxos(resolvedAddr, expectedDatumHash)
        }.getOrElse { emptyList() }
        // Full contribution history (spent + unspent), withdrawal change-back excluded.
        val contributions = runCatching {
            queries.getScriptContributions(resolvedAddr, expectedDatumHash)
        }.getOrElse { emptyList() }

        val balanceLovelace = utxos.sumOf { it.lovelace }
        call.respond(TreasuryBalanceResponse(
            treasuryAddress = resolvedAddr,
            balanceLovelace = balanceLovelace,
            utxos = utxos.map { u ->
                TreasuryUtxoItem(txHash = u.txHash, outputIndex = u.outputIndex, lovelace = u.lovelace)
            },
            contributions = contributions.map { u ->
                TreasuryUtxoItem(txHash = u.txHash, outputIndex = u.outputIndex, lovelace = u.lovelace)
            },
        ))
    }

    // POST /alliances/:id/proposals/:pid/finalize — member-triggered Finalization TX
    authenticate("jwt") {
        post("/alliances/{id}/proposals/{pid}/finalize") {
            val principal  = call.principal<JWTPrincipal>()!!
            val jwtDrepId  = principal.payload.getClaim("drepId")?.asString()
                ?: return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))
            val allianceId = requireUuid(call.parameters["id"], "id")
                ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
            val pid        = requireUuid(call.parameters["pid"], "pid")
                ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid proposal id"))

            // Verify caller is a member
            val isMember = transaction {
                AllianceMembers.selectAll()
                    .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId) }
                    .count() > 0
            }
            if (!isMember) return@post call.respond(HttpStatusCode.Forbidden, ApiError("Alliance membership required"))

            val (proposalRow, allianceRow) = transaction {
                val p = AllianceProposals.selectAll()
                    .where { (AllianceProposals.id eq pid) and (AllianceProposals.allianceId eq allianceId) }
                    .firstOrNull() ?: return@transaction null to null
                val a = Alliances.selectAll().where { Alliances.id eq allianceId }.firstOrNull()
                p to a
            }

            if (proposalRow == null || allianceRow == null)
                return@post call.respond(HttpStatusCode.NotFound, ApiError("Proposal not found"))
            if (proposalRow[AllianceProposals.proposalType] != "withdrawal")
                return@post call.respond(HttpStatusCode.BadRequest, ApiError("Only withdrawal proposals can be finalized"))
            if (proposalRow[AllianceProposals.status] != "approved")
                return@post call.respond(HttpStatusCode.Conflict, ApiError("Proposal must be in 'approved' status"))
            if (proposalRow[AllianceProposals.finalizationTxHash] != null)
                return@post call.respond(HttpStatusCode.Conflict, ApiError("Finalization TX already submitted"))

            val network = networkFromString(allianceRow[Alliances.network])
            val txHash = FinalizationTxSubmitter.submitFinalizationTx(
                proposalId       = pid,
                allianceId       = allianceId,
                result           = "approved",
                amountLovelace   = proposalRow[AllianceProposals.amountLovelace] ?: 0L,
                recipientAddress = proposalRow[AllianceProposals.recipientAddress] ?: "",
                timelockHours    = allianceRow[Alliances.timelockHours],
                network          = network,
            )

            if (txHash != null) call.respond(mapOf("txHash" to txHash))
            else call.respond(HttpStatusCode.InternalServerError, ApiError("Finalization TX failed — SERVICE_WALLET_MNEMONIC may not be set"))
        }
    }
}
