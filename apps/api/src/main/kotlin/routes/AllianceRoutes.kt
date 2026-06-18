package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.networkFromString
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.db.Alliances
import vote.tempo.db.AllianceMembers
import vote.tempo.plugins.ApiError
import java.util.UUID

// ─── Response DTOs ────────────────────────────────────────────────────────────

@Serializable
data class AllianceItem(
    val id: String,
    val name: String,
    val description: String?,
    val tags: List<String>,
    val network: String,
    val memberCount: Int,
    val createdAt: String,
)

@Serializable
data class AllianceDetail(
    val id: String,
    val name: String,
    val description: String?,
    val charter: String?,
    val tags: List<String>,
    val creatorDrepId: String,
    val network: String,
    val treasuryAddress: String?,
    val approvalThresholdVp: Int,
    val approvalThresholdCount: Int,
    val quorumThreshold: Int,
    val vpCapPct: Int,
    val timelockHours: Int,
    val maxWithdrawalPct: Int,
    val proposalDurationDays: Int,
    val memberCount: Int,
    val myMembership: MembershipInfo?,
    val createdAt: String,
)

@Serializable
data class MembershipInfo(
    val role: String,
    val joinedAt: String,
)

@Serializable
data class AllianceMemberItem(
    val id: String,
    val drepId: String,
    val stakeAddress: String,
    val role: String,
    val joinedAt: String,
)

@Serializable
data class AllianceListResponse(
    val items: List<AllianceItem>,
    val total: Int,
    val page: Int,
    val limit: Int,
)

@Serializable
data class AllianceMembersResponse(
    val items: List<AllianceMemberItem>,
    val total: Int,
)

// ─── Request DTOs ─────────────────────────────────────────────────────────────

@Serializable
data class CreateAllianceRequest(
    val name: String,
    val description: String? = null,
    val charter: String? = null,
    val tags: List<String> = emptyList(),
    val network: String,
)

@Serializable
data class UpdateAllianceRequest(
    val name: String? = null,
    val description: String? = null,
    val charter: String? = null,
    val tags: List<String>? = null,
)

@Serializable
data class JoinAllianceRequest(
    val network: String,
    val drepId: String,
    val stakeAddress: String,
)

@Serializable
data class UpdateMemberRoleRequest(
    val role: String,  // admin | member
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

private fun parseTags(raw: String): List<String> =
    runCatching { Json.decodeFromString<List<String>>(raw) }.getOrElse { emptyList() }

private fun encodeTags(tags: List<String>): String =
    Json.encodeToString(tags.filter { it.isNotBlank() })

private fun requireUuid(str: String?, name: String): UUID? =
    str?.let { runCatching { UUID.fromString(it) }.getOrNull() }

// ─── Routes ──────────────────────────────────────────────────────────────────

fun Route.allianceRoutes() {
    route("/alliances") {

        // GET /alliances?network=preprod&page=1&tag=fiscal
        get {
            val network = call.request.queryParameters["network"] ?: "mainnet"
            val tag     = call.request.queryParameters["tag"]
            val page    = (call.request.queryParameters["page"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
            val limit   = 20
            val offset  = ((page - 1) * limit).toLong()

            val (items, total) = transaction {
                var query = Alliances.selectAll().where { Alliances.network eq network }

                val total = query.count().toInt()

                val rows = query
                    .orderBy(Alliances.createdAt, SortOrder.DESC)
                    .limit(limit).offset(offset)
                    .toList()

                val allianceIds = rows.map { it[Alliances.id] }
                val memberCounts: Map<UUID, Long> = if (allianceIds.isEmpty()) emptyMap() else {
                    AllianceMembers.id.count().let { countExpr ->
                        AllianceMembers
                            .select(AllianceMembers.allianceId, countExpr)
                            .where { AllianceMembers.allianceId inList allianceIds }
                            .groupBy(AllianceMembers.allianceId)
                            .associate { it[AllianceMembers.allianceId] to it[countExpr] }
                    }
                }

                val items = rows
                    .filter { row ->
                        if (tag == null) true
                        else parseTags(row[Alliances.tags]).any { it.equals(tag, ignoreCase = true) }
                    }
                    .map { row ->
                        val id = row[Alliances.id]
                        AllianceItem(
                            id          = id.toString(),
                            name        = row[Alliances.name],
                            description = row[Alliances.description],
                            tags        = parseTags(row[Alliances.tags]),
                            network     = row[Alliances.network],
                            memberCount = (memberCounts[id] ?: 0L).toInt(),
                            createdAt   = row[Alliances.createdAt].toString(),
                        )
                    }

                items to total
            }

            call.respond(AllianceListResponse(items = items, total = total, page = page, limit = limit))
        }

        // GET /alliances/:id?drepId=drep1...  (drepId optional — to get myMembership)
        get("/{id}") {
            val id = requireUuid(call.parameters["id"], "id")
                ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
            val callerDrepId = call.request.queryParameters["drepId"]

            val result = transaction {
                val row = Alliances.selectAll().where { Alliances.id eq id }.singleOrNull()
                    ?: return@transaction null

                val memberCount = AllianceMembers.selectAll()
                    .where { AllianceMembers.allianceId eq id }
                    .count().toInt()

                val myMembership: MembershipInfo? = callerDrepId?.let { drepId ->
                    AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq id) and (AllianceMembers.drepId eq drepId) }
                        .singleOrNull()
                        ?.let { m -> MembershipInfo(role = m[AllianceMembers.role], joinedAt = m[AllianceMembers.joinedAt].toString()) }
                }

                AllianceDetail(
                    id                    = row[Alliances.id].toString(),
                    name                  = row[Alliances.name],
                    description           = row[Alliances.description],
                    charter               = row[Alliances.charter],
                    tags                  = parseTags(row[Alliances.tags]),
                    creatorDrepId         = row[Alliances.creatorDrepId],
                    network               = row[Alliances.network],
                    treasuryAddress       = row[Alliances.treasuryAddress],
                    approvalThresholdVp   = row[Alliances.approvalThresholdVp],
                    approvalThresholdCount= row[Alliances.approvalThresholdCount],
                    quorumThreshold       = row[Alliances.quorumThreshold],
                    vpCapPct              = row[Alliances.vpCapPct],
                    timelockHours         = row[Alliances.timelockHours],
                    maxWithdrawalPct      = row[Alliances.maxWithdrawalPct],
                    proposalDurationDays  = row[Alliances.proposalDurationDays],
                    memberCount           = memberCount,
                    myMembership          = myMembership,
                    createdAt             = row[Alliances.createdAt].toString(),
                )
            }

            if (result == null) call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))
            else call.respond(result)
        }

        // GET /alliances/:id/members?page=1
        get("/{id}/members") {
            val id = requireUuid(call.parameters["id"], "id")
                ?: return@get call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
            val page  = (call.request.queryParameters["page"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
            val limit = 50
            val offset = ((page - 1) * limit).toLong()

            val exists = transaction { Alliances.selectAll().where { Alliances.id eq id }.count() > 0 }
            if (!exists) return@get call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))

            val (items, total) = transaction {
                val total = AllianceMembers.selectAll()
                    .where { AllianceMembers.allianceId eq id }
                    .count().toInt()

                val rows = AllianceMembers.selectAll()
                    .where { AllianceMembers.allianceId eq id }
                    .orderBy(AllianceMembers.joinedAt, SortOrder.ASC)
                    .limit(limit).offset(offset)
                    .map { row ->
                        AllianceMemberItem(
                            id           = row[AllianceMembers.id].toString(),
                            drepId       = row[AllianceMembers.drepId],
                            stakeAddress = row[AllianceMembers.stakeAddress],
                            role         = row[AllianceMembers.role],
                            joinedAt     = row[AllianceMembers.joinedAt].toString(),
                        )
                    }
                rows to total
            }

            call.respond(AllianceMembersResponse(items = items, total = total))
        }

        // ── Authenticated routes ──────────────────────────────────────────────

        authenticate("jwt") {

            // POST /alliances  — Create alliance (JWT DRep becomes owner + first member)
            post {
                val principal    = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject
                val jwtDrepId    = principal.payload.getClaim("drepId")?.asString()
                    ?: return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val req = call.receive<CreateAllianceRequest>()

                if (req.name.isBlank()) {
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("name required"))
                }
                if (req.name.length > 100) {
                    return@post call.respond(HttpStatusCode.BadRequest, ApiError("name too long (max 100)"))
                }

                // Verify DRep is registered on-chain
                val network = networkFromString(req.network)
                val isRegistered = runCatching {
                    val raw = OgmiosStateQueries(network).getDRepByIdRaw(jwtDrepId)
                    val arr = raw as? kotlinx.serialization.json.JsonArray
                    arr != null && arr.isNotEmpty()
                }.getOrElse { false }

                if (!isRegistered) {
                    return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep is not registered on-chain"))
                }

                // DRep must not already be in an alliance
                val alreadyMember = transaction {
                    AllianceMembers.selectAll()
                        .where { (AllianceMembers.drepId eq jwtDrepId) and (AllianceMembers.network eq req.network) }
                        .count() > 0
                }
                if (alreadyMember) {
                    return@post call.respond(HttpStatusCode.Conflict, ApiError("DRep is already a member of an alliance"))
                }

                val result = runCatching {
                    transaction {
                        val allianceId = Alliances.insert {
                            it[name]           = req.name.trim()
                            it[description]    = req.description?.trim()
                            it[charter]        = req.charter?.trim()
                            it[tags]           = encodeTags(req.tags)
                            it[creatorDrepId]  = jwtDrepId
                            it[Alliances.network] = req.network
                        }[Alliances.id]

                        AllianceMembers.insert {
                            it[AllianceMembers.allianceId]   = allianceId
                            it[AllianceMembers.drepId]       = jwtDrepId
                            it[AllianceMembers.stakeAddress] = stakeAddress
                            it[AllianceMembers.network]      = req.network
                            it[role]                         = "owner"
                        }

                        allianceId.toString()
                    }
                }

                result.fold(
                    onSuccess = { id -> call.respond(HttpStatusCode.Created, mapOf("id" to id)) },
                    onFailure = { e ->
                        if (e.message?.contains("unique", ignoreCase = true) == true)
                            call.respond(HttpStatusCode.Conflict, ApiError("Alliance name already taken on this network"))
                        else
                            call.respond(HttpStatusCode.InternalServerError, ApiError(e.message ?: "Failed to create alliance"))
                    }
                )
            }

            // PATCH /alliances/:id  — Update name/description/charter/tags (owner only)
            patch("/{id}") {
                val principal = call.principal<JWTPrincipal>()!!
                val jwtDrepId = principal.payload.getClaim("drepId")?.asString()
                    ?: return@patch call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val id = requireUuid(call.parameters["id"], "id")
                    ?: return@patch call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))

                val req = call.receive<UpdateAllianceRequest>()

                val error = transaction {
                    val alliance = Alliances.selectAll().where { Alliances.id eq id }.singleOrNull()
                        ?: return@transaction "not_found"
                    if (alliance[Alliances.creatorDrepId] != jwtDrepId) return@transaction "forbidden"

                    Alliances.update({ Alliances.id eq id }) {
                        req.name?.trim()?.takeIf { it.isNotBlank() }?.let { v -> it[name] = v }
                        req.description?.let { v -> it[description] = v.trim().ifBlank { null } }
                        req.charter?.let { v -> it[charter] = v.trim().ifBlank { null } }
                        req.tags?.let { v -> it[tags] = encodeTags(v) }
                    }
                    null
                }

                when (error) {
                    "not_found" -> call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))
                    "forbidden" -> call.respond(HttpStatusCode.Forbidden, ApiError("Only the alliance owner can update"))
                    else        -> call.respond(mapOf("ok" to true))
                }
            }

            // POST /alliances/:id/join
            post("/{id}/join") {
                val principal    = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject
                val jwtDrepId    = principal.payload.getClaim("drepId")?.asString()
                    ?: return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId = requireUuid(call.parameters["id"], "id")
                    ?: return@post call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))

                val alliance = transaction {
                    Alliances.selectAll().where { Alliances.id eq allianceId }.singleOrNull()
                } ?: return@post call.respond(HttpStatusCode.NotFound, ApiError("Alliance not found"))

                val network = alliance[Alliances.network]

                // Verify DRep registered on-chain
                val isRegistered = runCatching {
                    val raw = OgmiosStateQueries(networkFromString(network)).getDRepByIdRaw(jwtDrepId)
                    val arr = raw as? kotlinx.serialization.json.JsonArray
                    arr != null && arr.isNotEmpty()
                }.getOrElse { false }

                if (!isRegistered) {
                    return@post call.respond(HttpStatusCode.Forbidden, ApiError("DRep is not registered on-chain"))
                }

                // DRep must not already be in any alliance on this network
                val alreadyMember = transaction {
                    AllianceMembers.selectAll()
                        .where { (AllianceMembers.drepId eq jwtDrepId) and (AllianceMembers.network eq network) }
                        .count() > 0
                }
                if (alreadyMember) {
                    return@post call.respond(HttpStatusCode.Conflict, ApiError("DRep is already a member of an alliance"))
                }

                val result = runCatching {
                    transaction {
                        AllianceMembers.insert {
                            it[AllianceMembers.allianceId]   = allianceId
                            it[AllianceMembers.drepId]       = jwtDrepId
                            it[AllianceMembers.stakeAddress] = stakeAddress
                            it[AllianceMembers.network]      = network
                            it[role]                         = "member"
                        }
                    }
                }

                result.fold(
                    onSuccess = { call.respond(HttpStatusCode.Created, mapOf("ok" to true)) },
                    onFailure = { e -> call.respond(HttpStatusCode.InternalServerError, ApiError(e.message ?: "Failed to join")) }
                )
            }

            // DELETE /alliances/:id/leave
            delete("/{id}/leave") {
                val principal = call.principal<JWTPrincipal>()!!
                val jwtDrepId = principal.payload.getClaim("drepId")?.asString()
                    ?: return@delete call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId = requireUuid(call.parameters["id"], "id")
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))

                val error = transaction {
                    val member = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId) }
                        .singleOrNull() ?: return@transaction "not_member"

                    // Owner cannot leave — must transfer ownership or disband
                    if (member[AllianceMembers.role] == "owner") return@transaction "owner_cannot_leave"

                    AllianceMembers.deleteWhere {
                        (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq jwtDrepId)
                    }
                    null
                }

                when (error) {
                    "not_member"         -> call.respond(HttpStatusCode.NotFound, ApiError("Not a member of this alliance"))
                    "owner_cannot_leave" -> call.respond(HttpStatusCode.BadRequest, ApiError("Owner cannot leave — transfer ownership first"))
                    else                 -> call.respond(mapOf("ok" to true))
                }
            }

            // PATCH /alliances/:id/members/:drepId/role  (owner/admin only)
            patch("/{id}/members/{drepId}/role") {
                val principal    = call.principal<JWTPrincipal>()!!
                val callerDrepId = principal.payload.getClaim("drepId")?.asString()
                    ?: return@patch call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId  = requireUuid(call.parameters["id"], "id")
                    ?: return@patch call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
                val targetDrepId = call.parameters["drepId"]
                    ?: return@patch call.respond(HttpStatusCode.BadRequest, ApiError("drepId required"))

                val req = call.receive<UpdateMemberRoleRequest>()
                if (req.role !in setOf("admin", "member")) {
                    return@patch call.respond(HttpStatusCode.BadRequest, ApiError("role must be 'admin' or 'member'"))
                }

                val error = transaction {
                    val callerMember = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq callerDrepId) }
                        .singleOrNull() ?: return@transaction "forbidden"
                    if (callerMember[AllianceMembers.role] !in setOf("owner", "admin")) return@transaction "forbidden"

                    val targetMember = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq targetDrepId) }
                        .singleOrNull() ?: return@transaction "not_found"
                    if (targetMember[AllianceMembers.role] == "owner") return@transaction "cannot_change_owner"

                    AllianceMembers.update({
                        (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq targetDrepId)
                    }) { it[role] = req.role }
                    null
                }

                when (error) {
                    "forbidden"           -> call.respond(HttpStatusCode.Forbidden, ApiError("Insufficient permissions"))
                    "not_found"           -> call.respond(HttpStatusCode.NotFound, ApiError("Member not found"))
                    "cannot_change_owner" -> call.respond(HttpStatusCode.BadRequest, ApiError("Cannot change owner role"))
                    else                  -> call.respond(mapOf("ok" to true))
                }
            }

            // DELETE /alliances/:id/members/:drepId  (owner/admin kick)
            delete("/{id}/members/{drepId}") {
                val principal    = call.principal<JWTPrincipal>()!!
                val callerDrepId = principal.payload.getClaim("drepId")?.asString()
                    ?: return@delete call.respond(HttpStatusCode.Forbidden, ApiError("DRep ID required"))

                val allianceId   = requireUuid(call.parameters["id"], "id")
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ApiError("Invalid alliance id"))
                val targetDrepId = call.parameters["drepId"]
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, ApiError("drepId required"))

                val error = transaction {
                    val callerMember = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq callerDrepId) }
                        .singleOrNull() ?: return@transaction "forbidden"
                    if (callerMember[AllianceMembers.role] !in setOf("owner", "admin")) return@transaction "forbidden"

                    val targetMember = AllianceMembers.selectAll()
                        .where { (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq targetDrepId) }
                        .singleOrNull() ?: return@transaction "not_found"
                    if (targetMember[AllianceMembers.role] == "owner") return@transaction "cannot_kick_owner"

                    AllianceMembers.deleteWhere {
                        (AllianceMembers.allianceId eq allianceId) and (AllianceMembers.drepId eq targetDrepId)
                    }
                    null
                }

                when (error) {
                    "forbidden"       -> call.respond(HttpStatusCode.Forbidden, ApiError("Insufficient permissions"))
                    "not_found"       -> call.respond(HttpStatusCode.NotFound, ApiError("Member not found"))
                    "cannot_kick_owner" -> call.respond(HttpStatusCode.BadRequest, ApiError("Cannot kick the owner"))
                    else              -> call.respond(HttpStatusCode.OK, mapOf("ok" to true))
                }
            }
        }
    }
}
