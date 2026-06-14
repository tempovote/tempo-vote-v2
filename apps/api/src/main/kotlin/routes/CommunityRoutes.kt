package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.Network
import vote.tempo.cardano.OgmiosStateQueries
import vote.tempo.cardano.credentialHexToDrepIdCip105
import vote.tempo.cardano.drepIdToCredentialHex
import vote.tempo.cardano.networkFromString
import vote.tempo.db.Communities
import vote.tempo.db.InternalPolls
import vote.tempo.db.PollComments
import vote.tempo.db.PollOptions
import vote.tempo.db.PollVotes
import kotlinx.serialization.json.*
import java.util.UUID

// ─── Response DTOs ────────────────────────────────────────────────────────────

@Serializable
data class CreatePollResponse(val id: String)

@Serializable
data class CommunityResponse(
    val id: String,
    val drepId: String,
    val network: String,
    val isActive: Boolean,
    val activatedAt: String?,
)

@Serializable
data class ActivateCommunityResponse(val id: String, val isActive: Boolean)

@Serializable
data class PollOptionDetail(
    val id: String,
    val text: String,
    val order: Int,
    val voteCount: Int,
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
data class PollDetailResponse(
    val id: String,
    val communityId: String,
    val title: String,
    val abstract: String?,
    val motivation: String?,
    val imageUrl: String?,
    val supportLinks: List<String>,
    val rationale: String?,
    val votingType: String,
    val status: String,
    val startsAt: String,
    val endsAt: String,
    val createdAt: String,
    val options: List<PollOptionDetail>,
    val totalVotes: Int,
    val userVote: String?,
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
    val drepId: String? = null,
    val drepName: String? = null,
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
    val motivation: String? = null,
    val imageUrl: String? = null,
    val supportLinks: List<String> = emptyList(),
    val rationale: String? = null,
    val votingType: String = "BASIC",   // BASIC | SINGLE_CHOICE | MULTIPLE_CHOICE
    val options: List<String> = emptyList(),  // custom options for SINGLE/MULTIPLE
    val startsAt: String,
    val endsAt: String,
)

@Serializable
data class AddCommentRequest(
    val content: String,
    val drepId: String? = null,
)

@Serializable
data class CastVoteRequest(
    val optionId: String,
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

private val BASIC_OPTIONS = listOf("Yes", "No", "Abstain")

private fun computeStatus(
    startsAt: kotlinx.datetime.LocalDateTime,
    endsAt: kotlinx.datetime.LocalDateTime,
    now: kotlinx.datetime.LocalDateTime,
) = when {
    endsAt < now   -> "closed"
    startsAt > now -> "pending"
    else           -> "active"
}

/**
 * Community membership: who may Create / Vote / Comment in a DRep's community.
 * Per product model the set is "the DRep itself + its delegators" — NOT any wallet.
 *   • Owner: the connected wallet's own DRep credential == this community's DRep.
 *   • Delegator: the authenticated stake address has delegated voting power to this DRep.
 * Both IDs are normalised to credential hex so bech32 / CIP-129 forms compare equal.
 * (Future scope — allowing any user — would simply relax this to `true`.)
 */
private suspend fun canParticipate(
    stakeAddress: String,
    jwtDrepId: String?,
    communityDrepId: String,
    network: Network,
): Boolean {
    val targetCred = runCatching { drepIdToCredentialHex(communityDrepId) }.getOrNull() ?: return false

    // 1) Owner — the wallet IS the DRep that owns this community.
    if (jwtDrepId != null) {
        val ownCred = runCatching { drepIdToCredentialHex(jwtDrepId) }.getOrNull()
        if (ownCred != null && ownCred == targetCred) return true
    }

    // 2) Delegator — the stake delegated its voting power to this DRep.
    val delegatedCred = resolveDelegatedDrepCred(stakeAddress, network) ?: return false
    return delegatedCred == targetCred
}

/**
 * Resolve which DRep (credential hex) a stake address delegated voting power to,
 * or null if none / not delegated to a registered DRep. Reuses the same 60-s
 * `stakeDeleg` cache the /stake/{addr}/delegation route populates, so a freshly
 * connected wallet hits cache and pays no Ogmios round-trip here.
 */
private suspend fun resolveDelegatedDrepCred(stakeAddress: String, network: Network): String? {
    val cacheKey = "${network.name}:$stakeAddress"

    CardanoCache.stakeDeleg.getIfPresent(cacheKey)?.let { cached ->
        val bech32 = (cached as? JsonObject)?.get("delegatedDrep")
            ?.let { it as? JsonObject }?.get("id")?.jsonPrimitive?.contentOrNull
        return bech32?.let { runCatching { drepIdToCredentialHex(it) }.getOrNull() }
    }

    val delegationRaw = runCatching { OgmiosStateQueries(network).getStakeDelegation(stakeAddress) }
        .getOrNull() ?: return null

    val accountInfo = when (delegationRaw) {
        is JsonArray  -> delegationRaw.firstOrNull()?.jsonObject
        is JsonObject -> delegationRaw[stakeAddress]?.jsonObject ?: delegationRaw.values.firstOrNull()?.jsonObject
        else          -> null
    }
    val drepCred = accountInfo?.let { info ->
        val delegate = info["delegateRepresentative"]?.jsonObject
        if (delegate?.get("type")?.jsonPrimitive?.contentOrNull == "registered")
            delegate["id"]?.jsonPrimitive?.contentOrNull
        else null
    }

    // Populate the cache in the same shape as /stake/{addr}/delegation for consistency.
    val bech32 = drepCred?.let { credentialHexToDrepIdCip105(it) ?: it }
    val response = if (bech32 == null) buildJsonObject { put("delegatedDrep", JsonNull) }
        else buildJsonObject { putJsonObject("delegatedDrep") { put("id", bech32); put("name", JsonNull) } }
    CardanoCache.stakeDeleg.put(cacheKey, response)

    return drepCred
}

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

        // POST /communities/{drepId}/activate  [requires JWT, drepId must match JWT claim]
        // Body: { network, txHash }
        authenticate("jwt") {
            post("/{drepId}/activate") {
                val principal = call.principal<JWTPrincipal>()!!
                val jwtDrepId = principal.payload.getClaim("drepId")?.asString()
                val drepId = call.parameters["drepId"]
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "drepId required"))

                if (jwtDrepId == null || jwtDrepId != drepId) {
                    return@post call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Not authorized for this DRep"))
                }

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

                call.respond(ActivateCommunityResponse(id = communityId, isActive = true))
            }
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
                    PollItem(
                        id = pollId.toString(),
                        communityId = communityId.toString(),
                        title = row[InternalPolls.title],
                        abstract = row[InternalPolls.abstract],
                        status = computeStatus(row[InternalPolls.startsAt], row[InternalPolls.endsAt], now),
                        startsAt = row[InternalPolls.startsAt].toString(),
                        endsAt = row[InternalPolls.endsAt].toString(),
                        createdAt = row[InternalPolls.createdAt].toString(),
                        commentCount = (commentCounts[pollId] ?: 0L).toInt(),
                    )
                }

                items to total
            }

            call.respond(PollsPageResponse(items = items, total = total, page = page, limit = limit))
        }

        // POST /communities/{drepId}/polls  [requires JWT, drepId must match JWT claim]
        authenticate("jwt") {
            post("/{drepId}/polls") {
                val principal = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject
                val jwtDrepId = principal.payload.getClaim("drepId")?.asString()
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

                // Membership: the DRep itself or one of its delegators — not any wallet.
                if (!canParticipate(stakeAddress, jwtDrepId, drepId, networkFromString(req.network))) {
                    return@post call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Only the DRep and its delegators can create polls"))
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

                val allowedTypes = setOf("BASIC", "SINGLE_CHOICE", "MULTIPLE_CHOICE")
                val votingType = req.votingType.uppercase().takeIf { it in allowedTypes } ?: "BASIC"

                if (votingType != "BASIC" && req.options.size < 2) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "At least 2 options required for ${votingType}"))
                }

                val pollResult = runCatching {
                    transaction {
                        val id = InternalPolls.insert {
                            it[InternalPolls.communityId] = communityId
                            it[InternalPolls.title] = req.title.trim()
                            it[InternalPolls.abstract] = req.abstract?.trim()
                            it[InternalPolls.motivation] = req.motivation?.trim()
                            it[InternalPolls.imageUrl] = req.imageUrl?.trim()
                            it[InternalPolls.supportLinks] = if (req.supportLinks.isEmpty()) null
                                else Json.encodeToString(req.supportLinks.filter { l -> l.isNotBlank() })
                            it[InternalPolls.rationale] = req.rationale?.trim()
                            it[InternalPolls.votingType] = votingType
                            it[InternalPolls.startEpoch] = 0
                            it[InternalPolls.startsAt] = startsAt
                            it[InternalPolls.endsAt] = endsAt
                        }[InternalPolls.id]

                        val optionTexts = if (votingType == "BASIC") BASIC_OPTIONS else req.options.filter { it.isNotBlank() }
                        optionTexts.forEachIndexed { idx, text ->
                            PollOptions.insert {
                                it[PollOptions.pollId] = id
                                it[PollOptions.text] = text.trim()
                                it[PollOptions.order] = idx
                            }
                        }

                        id.toString()
                    }
                }

                pollResult.fold(
                    onSuccess = { pollId ->
                        call.respond(HttpStatusCode.Created, CreatePollResponse(id = pollId))
                    },
                    onFailure = { e ->
                        call.respond(HttpStatusCode.InternalServerError, vote.tempo.plugins.ApiError(e.message ?: "Failed to create poll"))
                    }
                )
            }
        }

        // GET /communities/polls/{pollId}?stakeAddress=stake1...
        get("/polls/{pollId}") {
            val pollIdStr = call.parameters["pollId"]
                ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "pollId required"))
            val pollId = runCatching { UUID.fromString(pollIdStr) }.getOrElse {
                return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid pollId"))
            }
            val stakeAddress = call.request.queryParameters["stakeAddress"]

            val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)

            val result = transaction {
                val pollRow = InternalPolls.selectAll()
                    .where { InternalPolls.id eq pollId }
                    .singleOrNull()
                    ?: return@transaction null

                // Load options with vote counts
                val voteCounts: Map<UUID, Long> = PollVotes.optionId.count().let { countExpr ->
                    PollVotes
                        .select(PollVotes.optionId, countExpr)
                        .where { PollVotes.pollId eq pollId }
                        .groupBy(PollVotes.optionId)
                        .associate { it[PollVotes.optionId] to it[countExpr] }
                }

                val options = PollOptions.selectAll()
                    .where { PollOptions.pollId eq pollId }
                    .orderBy(PollOptions.order, SortOrder.ASC)
                    .map { row ->
                        PollOptionDetail(
                            id = row[PollOptions.id].toString(),
                            text = row[PollOptions.text],
                            order = row[PollOptions.order],
                            voteCount = (voteCounts[row[PollOptions.id]] ?: 0L).toInt(),
                        )
                    }

                val totalVotes = options.sumOf { it.voteCount }

                // Check if stakeAddress has already voted
                val userVote: String? = if (stakeAddress != null) {
                    PollVotes.selectAll()
                        .where { (PollVotes.pollId eq pollId) and (PollVotes.stakeAddress eq stakeAddress) }
                        .singleOrNull()
                        ?.get(PollVotes.optionId)
                        ?.toString()
                } else null

                val rawLinks = pollRow[InternalPolls.supportLinks]
                val parsedLinks: List<String> = if (rawLinks != null)
                    runCatching { Json.decodeFromString<List<String>>(rawLinks) }.getOrElse { emptyList() }
                else emptyList()

                PollDetailResponse(
                    id = pollId.toString(),
                    communityId = pollRow[InternalPolls.communityId].toString(),
                    title = pollRow[InternalPolls.title],
                    abstract = pollRow[InternalPolls.abstract],
                    motivation = pollRow[InternalPolls.motivation],
                    imageUrl = pollRow[InternalPolls.imageUrl],
                    supportLinks = parsedLinks,
                    rationale = pollRow[InternalPolls.rationale],
                    votingType = pollRow[InternalPolls.votingType],
                    status = computeStatus(pollRow[InternalPolls.startsAt], pollRow[InternalPolls.endsAt], now),
                    startsAt = pollRow[InternalPolls.startsAt].toString(),
                    endsAt = pollRow[InternalPolls.endsAt].toString(),
                    createdAt = pollRow[InternalPolls.createdAt].toString(),
                    options = options,
                    totalVotes = totalVotes,
                    userVote = userVote,
                )
            }

            if (result == null) {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Poll not found"))
            } else {
                call.respond(result)
            }
        }

        // POST /communities/polls/{pollId}/vote  [requires JWT — stakeAddress comes from token]
        // Body: { optionId }
        authenticate("jwt") {
            post("/polls/{pollId}/vote") {
                val principal    = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject

                val pollIdStr = call.parameters["pollId"]
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "pollId required"))
                val pollId = runCatching { UUID.fromString(pollIdStr) }.getOrElse {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid pollId"))
                }
                val req = call.receive<CastVoteRequest>()
                val optionId = runCatching { UUID.fromString(req.optionId) }.getOrElse {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid optionId"))
                }

                // Membership: only the DRep + its delegators may vote.
                val community = transaction {
                    val poll = InternalPolls.selectAll().where { InternalPolls.id eq pollId }.singleOrNull()
                        ?: return@transaction null
                    Communities.selectAll().where { Communities.id eq poll[InternalPolls.communityId] }.singleOrNull()
                        ?.let { it[Communities.drepId] to it[Communities.network] }
                }
                if (community == null) {
                    return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Poll not found"))
                }
                if (!canParticipate(stakeAddress, principal.payload.getClaim("drepId")?.asString(), community.first, networkFromString(community.second))) {
                    return@post call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Only the DRep and its delegators can vote"))
                }

                val now = Clock.System.now().toLocalDateTime(TimeZone.UTC)

                val error: String? = transaction {
                    val poll = InternalPolls.selectAll().where { InternalPolls.id eq pollId }.singleOrNull()
                        ?: return@transaction "Poll not found"

                    val status = computeStatus(poll[InternalPolls.startsAt], poll[InternalPolls.endsAt], now)
                    if (status != "active") return@transaction "Poll is not active"

                    val optionExists = PollOptions.selectAll()
                        .where { (PollOptions.id eq optionId) and (PollOptions.pollId eq pollId) }
                        .count() > 0
                    if (!optionExists) return@transaction "Option does not belong to this poll"

                    val alreadyVoted = PollVotes.selectAll()
                        .where { (PollVotes.pollId eq pollId) and (PollVotes.stakeAddress eq stakeAddress) }
                        .count() > 0
                    if (alreadyVoted) return@transaction "Already voted"

                    PollVotes.insert {
                        it[PollVotes.pollId]       = pollId
                        it[PollVotes.optionId]     = optionId
                        it[PollVotes.stakeAddress] = stakeAddress
                        it[PollVotes.votingPower]  = 0L
                    }

                    null
                }

                when (error) {
                    null             -> call.respond(HttpStatusCode.Created, mapOf("ok" to true))
                    "Poll not found" -> call.respond(HttpStatusCode.NotFound, mapOf("error" to error))
                    "Already voted"  -> call.respond(HttpStatusCode.Conflict, mapOf("error" to error))
                    else             -> call.respond(HttpStatusCode.BadRequest, mapOf("error" to error))
                }
            }
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
                        val storedDrepId = row[PollComments.drepId]
                        val drepName = storedDrepId?.let { id ->
                            val networkName = if (id.startsWith("drep1")) "PREPROD" else "MAINNET"
                            val credHex = runCatching { drepIdToCredentialHex(id) }.getOrNull()
                            credHex?.let { CardanoCache.drepInfo.getIfPresent("$networkName:$credHex") }
                                ?.get("name")?.jsonPrimitive?.contentOrNull
                        }
                        PollCommentItem(
                            id = row[PollComments.id].toString(),
                            stakeAddress = row[PollComments.stakeAddress],
                            content = row[PollComments.content],
                            createdAt = row[PollComments.createdAt].toString(),
                            drepId   = storedDrepId,
                            drepName = drepName,
                        )
                    }
            }

            call.respond(CommentsPageResponse(items = comments, total = comments.size))
        }

        // POST /communities/polls/{pollId}/comments  [requires JWT — stakeAddress comes from token]
        // Body: { content }
        authenticate("jwt") {
            post("/polls/{pollId}/comments") {
                val principal    = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject

                val pollIdStr = call.parameters["pollId"]
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "pollId required"))
                val pollId = runCatching { UUID.fromString(pollIdStr) }.getOrElse {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid pollId"))
                }
                val req = call.receive<AddCommentRequest>()

                if (req.content.isBlank()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Content cannot be empty"))
                }

                // Membership: only the DRep + its delegators may comment.
                val community = transaction {
                    val poll = InternalPolls.selectAll().where { InternalPolls.id eq pollId }.singleOrNull()
                        ?: return@transaction null
                    Communities.selectAll().where { Communities.id eq poll[InternalPolls.communityId] }.singleOrNull()
                        ?.let { it[Communities.drepId] to it[Communities.network] }
                }
                if (community == null) {
                    return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Poll not found"))
                }
                if (!canParticipate(stakeAddress, principal.payload.getClaim("drepId")?.asString(), community.first, networkFromString(community.second))) {
                    return@post call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Only the DRep and its delegators can comment"))
                }

                // Validate drepId if provided — must be a registered DRep in the cache
                val verifiedDrepId = req.drepId?.trim()?.takeIf { drepId ->
                    val networkName = if (stakeAddress.startsWith("stake_test")) "PREPROD" else "MAINNET"
                    val credHex = runCatching { drepIdToCredentialHex(drepId) }.getOrNull() ?: return@takeIf false
                    val listRaw = CardanoCache.drepList.getIfPresent(networkName) ?: return@takeIf false
                    val dreps: JsonArray = when {
                        listRaw is JsonArray -> listRaw
                        listRaw is JsonObject && listRaw["delegateRepresentatives"] is JsonArray ->
                            listRaw["delegateRepresentatives"]!!.jsonArray
                        else -> return@takeIf false
                    }
                    dreps.mapNotNull { runCatching { it.jsonObject }.getOrNull() }
                        .any { entry ->
                            if (entry["type"]?.jsonPrimitive?.contentOrNull != "registered") return@any false
                            val id = entry["id"]?.jsonPrimitive?.contentOrNull ?: return@any false
                            id == credHex || id == drepId ||
                                (id.startsWith("drep") && runCatching { drepIdToCredentialHex(id) }.getOrNull() == credHex)
                        }
                }

                val commentId = transaction {
                    PollComments.insert {
                        it[PollComments.pollId]       = pollId
                        it[PollComments.stakeAddress] = stakeAddress
                        it[PollComments.drepId]       = verifiedDrepId
                        it[PollComments.content]      = req.content.trim()
                    }[PollComments.id].toString()
                }

                call.respond(HttpStatusCode.Created, mapOf("id" to commentId))
            }

            // DELETE /communities/polls/{pollId}/comments/{commentId}  [requires JWT]
            delete("/polls/{pollId}/comments/{commentId}") {
                val principal    = call.principal<JWTPrincipal>()!!
                val stakeAddress = principal.payload.subject

                val commentIdStr = call.parameters["commentId"]
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "commentId required"))
                val commentId = runCatching { UUID.fromString(commentIdStr) }.getOrElse {
                    return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid commentId"))
                }

                val deleteCondition = with(SqlExpressionBuilder) { PollComments.id eq commentId }

                val deleted = transaction {
                    val row = PollComments.selectAll()
                        .where { PollComments.id eq commentId }
                        .firstOrNull()
                        ?: return@transaction false

                    if (row[PollComments.stakeAddress] != stakeAddress) return@transaction null

                    PollComments.deleteWhere { deleteCondition }
                    true
                }

                when (deleted) {
                    null  -> call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Không thể xóa comment của người khác"))
                    false -> call.respond(HttpStatusCode.NotFound,   mapOf("error" to "Comment không tồn tại"))
                    true  -> call.respond(HttpStatusCode.OK,         mapOf("success" to true))
                }
            }
        }
    }
}
