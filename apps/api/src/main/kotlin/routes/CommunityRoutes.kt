package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.db.Communities
import vote.tempo.db.InternalPolls
import vote.tempo.db.PollComments
import java.util.UUID

// ─── Response DTOs ────────────────────────────────────────────────────────────

@Serializable
data class CommunityResponse(
    val id: String,
    val drepId: String,
    val network: String,
    val isActive: Boolean,
    val activatedAt: String?,
)

@Serializable
data class PollItem(
    val id: String,
    val communityId: String,
    val title: String,
    val abstract: String?,
    val status: String,
    val startsAt: String,
    val endsAt: String,
    val createdAt: String,
    val commentCount: Int,
)

@Serializable
data class PollsPageResponse(
    val items: List<PollItem>,
    val total: Int,
    val page: Int,
    val limit: Int,
)

@Serializable
data class PollCommentItem(
    val id: String,
    val stakeAddress: String,
    val content: String,
    val createdAt: String,
)

@Serializable
data class CommentsPageResponse(
    val items: List<PollCommentItem>,
    val total: Int,
)

// ─── Request DTOs ─────────────────────────────────────────────────────────────

@Serializable
data class ActivateCommunityRequest(
    val network: String,
    val txHash: String,
)

@Serializable
data class CreatePollRequest(
    val network: String,
    val title: String,
    val abstract: String? = null,
    val startsAt: String,
    val endsAt: String,
)

@Serializable
data class AddCommentRequest(
    val stakeAddress: String,
    val content: String,
)

// ─── Routes ──────────────────────────────────────────────────────────────────

fun Route.communityRoutes() {
    route("/communities") {

        // GET /communities/{drepId}?network=mainnet
        get("/{drepId}") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))
            val network = call.request.queryParameters["network"] ?: "mainnet"

            val row = transaction {
                Communities.selectAll()
                    .where { (Communities.drepId eq drepId) and (Communities.network eq network) }
                    .singleOrNull()
            }

            if (row == null) {
                call.respond(mapOf("isActive" to false))
            } else {
                call.respond(CommunityResponse(
                    id = row[Communities.id].toString(),
                    drepId = row[Communities.drepId],
                    network = row[Communities.network],
                    isActive = row[Communities.isActive],
                    activatedAt = row[Communities.activatedAt]?.toString(),
                ))
            }
        }

        // POST /communities/{drepId}/activate
        // Body: { network, txHash }  (txHash is stored for audit, not verified on-chain yet)
        post("/{drepId}/activate") {
            val drepId = call.parameters["drepId"]
                ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))
            val req = call.receive<ActivateCommunityRequest>()

            val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)

            val communityId = transaction {
                val existing = Communities.selectAll()
                    .where { (Communities.drepId eq drepId) and (Communities.network eq req.network) }
                    .singleOrNull()

                if (existing != null) {
                    if (!existing[Communities.isActive]) {
                        Communities.update({ (Communities.drepId eq drepId) and (Communities.network eq req.network) }) {
                            it[isActive] = true
                            it[activatedAt] = now
                        }
                    }
                    existing[Communities.id].toString()
                } else {
                    Communities.insert {
                        it[Communities.drepId] = drepId
                        it[Communities.network] = req.network
                        it[isActive] = true
                        it[activatedAt] = now
                    }[Communities.id].toString()
                }
            }

            call.respond(mapOf("id" to communityId, "isActive" to true))
        }

        // GET /communities/{drepId}/polls?network=mainnet&page=1
        get("/{drepId}/polls") {
            val drepId = call.parameters["drepId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))
            val network = call.request.queryParameters["network"] ?: "mainnet"
            val page = (call.request.queryParameters["page"]?.toIntOrNull() ?: 1).coerceAtLeast(1)
            val limit = 10
            val offset = ((page - 1) * limit).toLong()

            val communityRow = transaction {
                Communities.selectAll()
                    .where { (Communities.drepId eq drepId) and (Communities.network eq network) }
                    .singleOrNull()
            } ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Community not found"))

            val communityId = communityRow[Communities.id]
            val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)

            val (items, total) = transaction {
                val total = InternalPolls.selectAll()
                    .where { InternalPolls.communityId eq communityId }
                    .count().toInt()

                val rows = InternalPolls.selectAll()
                    .where { InternalPolls.communityId eq communityId }
                    .orderBy(InternalPolls.createdAt, SortOrder.DESC)
                    .limit(limit, offset)
                    .toList()

                // Batch-load comment counts for this page
                val pollIds = rows.map { it[InternalPolls.id] }
                val commentCounts: Map<UUID, Long> = if (pollIds.isEmpty()) emptyMap() else {
                    PollComments.id.count().let { countExpr ->
                        PollComments
                            .select(PollComments.pollId, countExpr)
                            .where { PollComments.pollId inList pollIds }
                            .groupBy(PollComments.pollId)
                            .associate { it[PollComments.pollId] to it[countExpr] }
                    }
                }

                val items = rows.map { row ->
                    val pollId = row[InternalPolls.id]
                    val endsAt = row[InternalPolls.endsAt]
                    val startsAt = row[InternalPolls.startsAt]
                    val status = when {
                        endsAt < now    -> "closed"
                        startsAt > now  -> "pending"
                        else            -> "active"
                    }
                    PollItem(
                        id = pollId.toString(),
                        communityId = communityId.toString(),
                        title = row[InternalPolls.title],
                        abstract = row[InternalPolls.abstract],
                        status = status,
                        startsAt = startsAt.toString(),
                        endsAt = endsAt.toString(),
                        createdAt = row[InternalPolls.createdAt].toString(),
                        commentCount = (commentCounts[pollId] ?: 0L).toInt(),
                    )
                }

                items to total
            }

            call.respond(PollsPageResponse(items = items, total = total, page = page, limit = limit))
        }

        // POST /communities/{drepId}/polls — create a new internal poll
        post("/{drepId}/polls") {
            val drepId = call.parameters["drepId"]
                ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))
            val req = call.receive<CreatePollRequest>()

            if (req.title.isBlank()) {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "title required"))
            }

            val communityRow = transaction {
                Communities.selectAll()
                    .where { (Communities.drepId eq drepId) and (Communities.network eq req.network) }
                    .singleOrNull()
            }

            if (communityRow == null || !communityRow[Communities.isActive]) {
                return@post call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Community not active"))
            }

            val communityId = communityRow[Communities.id]

            val startsAt = runCatching { Instant.parse(req.startsAt).toLocalDateTime(TimeZone.UTC) }.getOrElse {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid startsAt"))
            }
            val endsAt = runCatching { Instant.parse(req.endsAt).toLocalDateTime(TimeZone.UTC) }.getOrElse {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid endsAt"))
            }

            if (endsAt <= startsAt) {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "endsAt must be after startsAt"))
            }

            val pollId = transaction {
                InternalPolls.insert {
                    it[InternalPolls.communityId] = communityId
                    it[InternalPolls.title] = req.title.trim()
                    it[InternalPolls.abstract] = req.abstract?.trim()
                    it[InternalPolls.votingType] = "BASIC"
                    it[InternalPolls.startEpoch] = 0
                    it[InternalPolls.startsAt] = startsAt
                    it[InternalPolls.endsAt] = endsAt
                }[InternalPolls.id].toString()
            }

            call.respond(HttpStatusCode.Created, mapOf("id" to pollId))
        }

        // GET /communities/polls/{pollId}/comments
        get("/polls/{pollId}/comments") {
            val pollIdStr = call.parameters["pollId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "pollId required"))
            val pollId = runCatching { UUID.fromString(pollIdStr) }.getOrElse {
                return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid pollId"))
            }

            val comments = transaction {
                PollComments.selectAll()
                    .where { PollComments.pollId eq pollId }
                    .orderBy(PollComments.createdAt, SortOrder.ASC)
                    .map { row ->
                        PollCommentItem(
                            id = row[PollComments.id].toString(),
                            stakeAddress = row[PollComments.stakeAddress],
                            content = row[PollComments.content],
                            createdAt = row[PollComments.createdAt].toString(),
                        )
                    }
            }

            call.respond(CommentsPageResponse(items = comments, total = comments.size))
        }

        // POST /communities/polls/{pollId}/comments
        post("/polls/{pollId}/comments") {
            val pollIdStr = call.parameters["pollId"]
                ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "pollId required"))
            val pollId = runCatching { UUID.fromString(pollIdStr) }.getOrElse {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid pollId"))
            }
            val req = call.receive<AddCommentRequest>()

            if (req.content.isBlank()) {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Content cannot be empty"))
            }

            val pollExists = transaction {
                InternalPolls.selectAll().where { InternalPolls.id eq pollId }.count() > 0
            }
            if (!pollExists) {
                return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Poll not found"))
            }

            val commentId = transaction {
                PollComments.insert {
                    it[PollComments.pollId] = pollId
                    it[PollComments.stakeAddress] = req.stakeAddress
                    it[PollComments.content] = req.content.trim()
                }[PollComments.id].toString()
            }

            call.respond(HttpStatusCode.Created, mapOf("id" to commentId))
        }
    }
}
