package vote.tempo.routes

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.routing.routing
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assumptions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import vote.tempo.db.AllianceMembers
import vote.tempo.db.AllianceProposalVotes
import vote.tempo.db.AllianceProposals
import vote.tempo.db.Alliances
import vote.tempo.plugins.JWT_AUDIENCE
import vote.tempo.plugins.JWT_ISSUER
import vote.tempo.plugins.JWT_SECRET
import vote.tempo.plugins.configureSecurity
import vote.tempo.plugins.configureSerialization
import vote.tempo.testutil.TestDatabase
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AllianceProposalRoutesTest {

    private val ownerDrep = "drep182eqed5jzyh20cv6lskhf20uekww66t4t9llsg0r565zgmmhjc6"
    private val memberDrep = "drep1qgdea4s6eqs24uxyhxayf2cehh4gk0faqkfp0t0p4rhjkxfn58g3"
    private val outsiderDrep = "drep1xqahjgzlz39e8m7x39s2ntltwcyrq4twy3wjhm33agzrv9lhx56"

    @BeforeAll
    fun setup() {
        Assumptions.assumeTrue(TestDatabase.isDockerAvailable, "Docker not available — skipping integration tests")
        TestDatabase.setup()
    }

    @BeforeEach
    fun clean() {
        transaction {
            AllianceProposalVotes.deleteAll()
            AllianceProposals.deleteAll()
            AllianceMembers.deleteAll()
            Alliances.deleteAll()
        }
    }

    // ── Create proposal ───────────────────────────────────────────────────────

    @Test
    fun `member can create a ga_stance proposal`() {
        val allianceId = seedAlliance()
        seedMember(allianceId, ownerDrep, role = "owner")

        runApp {
            val res = createProposal(allianceId, ownerDrep, "ga_stance")
            assertEquals(HttpStatusCode.Created, res.status)
            assertNotNull(Json.parseToJsonElement(res.bodyAsText()).jsonObject["id"])
        }
    }

    @Test
    fun `non-member cannot create a proposal`() {
        val allianceId = seedAlliance()
        // outsiderDrep is not in alliance_members

        runApp {
            val res = createProposal(allianceId, outsiderDrep, "ga_stance")
            assertEquals(HttpStatusCode.Forbidden, res.status)
        }
    }

    @Test
    fun `JWT without drepId claim cannot create a proposal`() {
        val allianceId = seedAlliance()
        val tokenWithoutDrep = JWT.create()
            .withIssuer(JWT_ISSUER).withAudience(JWT_AUDIENCE).withSubject("stake_test1abc")
            .withClaim("network", "preprod")
            .sign(Algorithm.HMAC256(JWT_SECRET))

        runApp {
            val res = createProposal(allianceId, null, "ga_stance", overrideToken = tokenWithoutDrep)
            assertEquals(HttpStatusCode.Forbidden, res.status)
        }
    }

    // ── Vote ─────────────────────────────────────────────────────────────────

    @Test
    fun `member can vote YES on an open proposal`() {
        val allianceId = seedAlliance()
        seedMember(allianceId, ownerDrep, role = "owner")
        val pid = seedProposal(allianceId, ownerDrep, endsInFuture = true)

        runApp {
            val res = castVote(allianceId, pid, ownerDrep, "YES")
            assertEquals(HttpStatusCode.OK, res.status)
        }
    }

    @Test
    fun `non-member cannot vote (alliance lookup returns 404)`() {
        val allianceId = seedAlliance()
        seedMember(allianceId, ownerDrep, role = "owner")
        val pid = seedProposal(allianceId, ownerDrep, endsInFuture = true)

        runApp {
            // outsiderDrep not in alliance_members → ctx is null → 404
            val res = castVote(allianceId, pid, outsiderDrep, "YES")
            assertEquals(HttpStatusCode.NotFound, res.status)
        }
    }

    @Test
    fun `cannot vote after the voting period has ended`() {
        val allianceId = seedAlliance()
        seedMember(allianceId, ownerDrep, role = "owner")
        val pid = seedProposal(allianceId, ownerDrep, endsInFuture = false)  // already expired

        runApp {
            val res = castVote(allianceId, pid, ownerDrep, "YES")
            assertEquals(HttpStatusCode.Conflict, res.status)
        }
    }

    @Test
    fun `voting twice updates the existing vote`() {
        val allianceId = seedAlliance()
        seedMember(allianceId, ownerDrep, role = "owner")
        val pid = seedProposal(allianceId, ownerDrep, endsInFuture = true)

        runApp {
            castVote(allianceId, pid, ownerDrep, "YES")
            val res = castVote(allianceId, pid, ownerDrep, "NO")
            assertEquals(HttpStatusCode.OK, res.status)
        }

        val storedVote = transaction {
            AllianceProposalVotes.selectAll()
                .where { AllianceProposalVotes.proposalId eq pid }
                .toList()
        }
        assertEquals(1, storedVote.size, "Should have exactly 1 vote row (upsert)")
        assertEquals("NO", storedVote.first()[AllianceProposalVotes.vote])
    }

    // ── Snapshot member count ─────────────────────────────────────────────────

    @Test
    fun `autoClose sets snapshot_member_count to members who joined before votingEndsAt`() {
        val allianceId = seedAlliance()

        val votingEndsAt = Clock.System.now().minus(1.hours).toLocalDateTime(TimeZone.UTC)

        // Member joined 2h before voting ended — should be counted
        val earlyJoin = Clock.System.now().minus(3.hours).toLocalDateTime(TimeZone.UTC)
        seedMember(allianceId, ownerDrep, role = "owner", joinedAt = earlyJoin)

        // Member joined 30 min AFTER voting ended — should NOT be counted
        val lateJoin = Clock.System.now().minus(30.hours.unaryMinus()).toLocalDateTime(TimeZone.UTC)
        // ^ Clock.now() + 30min would be future, but we want it after votingEndsAt (past).
        // votingEndsAt = now - 1h. Late joiner = now - 30min (which is after votingEndsAt).
        val lateJoinAt = Clock.System.now().minus(0.5.hours).toLocalDateTime(TimeZone.UTC)
        seedMember(allianceId, memberDrep, role = "member", joinedAt = lateJoinAt)

        // Seed an already-expired proposal
        val pid = seedProposalWithCustomEndsAt(allianceId, ownerDrep, votingEndsAt)

        // Trigger auto-close
        autoCloseExpiredProposals()

        // Verify snapshot_member_count = 1 (only earlyJoin counted)
        val snapshotCount = transaction {
            AllianceProposals.selectAll()
                .where { AllianceProposals.id eq pid }
                .first()[AllianceProposals.snapshotMemberCount]
        }
        assertEquals(1, snapshotCount, "Only the member who joined before votingEndsAt should be counted")
    }

    @Test
    fun `proposal list returns correct totalMembers from snapshot after close`() {
        val allianceId = seedAlliance()
        val votingEndsAt = Clock.System.now().minus(1.hours).toLocalDateTime(TimeZone.UTC)

        seedMember(allianceId, ownerDrep, role = "owner",
            joinedAt = Clock.System.now().minus(2.hours).toLocalDateTime(TimeZone.UTC))

        val pid = seedProposalWithCustomEndsAt(allianceId, ownerDrep, votingEndsAt)
        autoCloseExpiredProposals()

        // A new member joins AFTER proposal is closed
        seedMember(allianceId, memberDrep, role = "member")

        runApp {
            val res = client.get("/alliances/$allianceId/proposals")
            assertEquals(HttpStatusCode.OK, res.status)
            val body = Json.parseToJsonElement(res.bodyAsText()).jsonObject
            val item = body["items"]!!.let {
                kotlinx.serialization.json.Json.decodeFromString<ProposalListResponse>(body.toString()).items.first()
            }
            assertEquals(1, item.tally.totalMembers,
                "totalMembers should be frozen at 1 (snapshot), not 2 (current)")
        }
    }

    // ── Harness ─────────────────────────────────────────────────────────────

    private fun runApp(block: suspend ApplicationTestBuilder.() -> Unit) = testApplication {
        application {
            configureSerialization()
            configureSecurity()
            routing {
                allianceRoutes()
                allianceProposalRoutes()
            }
        }
        block()
    }

    private fun jwt(drepId: String?, stake: String = "stake_test1owner", network: String = "preprod"): String =
        JWT.create()
            .withIssuer(JWT_ISSUER)
            .withAudience(JWT_AUDIENCE)
            .withSubject(stake)
            .withClaim("network", network)
            .apply { if (drepId != null) withClaim("drepId", drepId) }
            .sign(Algorithm.HMAC256(JWT_SECRET))

    private suspend fun ApplicationTestBuilder.createProposal(
        allianceId: UUID,
        drepId: String?,
        proposalType: String,
        overrideToken: String? = null,
    ) = client.post("/alliances/$allianceId/proposals") {
        bearerAuth(overrideToken ?: jwt(drepId))
        contentType(ContentType.Application.Json)
        setBody("""
            {
              "proposalType": "$proposalType",
              "title": "Test proposal",
              "govActionTxHash": "aaaa${"bb".repeat(30)}",
              "govActionIndex": 0
            }
        """.trimIndent())
    }

    private suspend fun ApplicationTestBuilder.castVote(
        allianceId: UUID,
        pid: UUID,
        drepId: String,
        vote: String,
    ) = client.post("/alliances/$allianceId/proposals/$pid/vote") {
        bearerAuth(jwt(drepId))
        contentType(ContentType.Application.Json)
        setBody("""{"vote":"$vote"}""")
    }

    // ── DB seed helpers ──────────────────────────────────────────────────────

    private fun seedAlliance(): UUID = transaction {
        Alliances.insert {
            it[name]              = "Test Alliance ${UUID.randomUUID()}"
            it[creatorDrepId]     = ownerDrep
            it[network]           = "preprod"
            it[quorumThreshold]   = 30
            it[approvalThresholdVp]    = 60
            it[approvalThresholdCount] = 50
            it[vpCapPct]          = 20
            it[timelockHours]     = 48
            it[proposalDurationDays]   = 7
        }[Alliances.id]
    }

    private fun seedMember(
        allianceId: UUID,
        drepId: String,
        role: String = "member",
        joinedAt: kotlinx.datetime.LocalDateTime? = null,
    ) = transaction {
        AllianceMembers.insert {
            it[AllianceMembers.allianceId]   = allianceId
            it[AllianceMembers.drepId]       = drepId
            it[stakeAddress]                 = "stake_test1_${drepId.takeLast(8)}"
            it[network]                      = "preprod"
            it[AllianceMembers.role]         = role
            if (joinedAt != null) it[AllianceMembers.joinedAt] = joinedAt
        }[AllianceMembers.id]
    }

    private fun seedProposal(
        allianceId: UUID,
        proposerDrepId: String,
        endsInFuture: Boolean,
    ): UUID = transaction {
        val ends = if (endsInFuture)
            Clock.System.now().plus(7.days).toLocalDateTime(TimeZone.UTC)
        else
            Clock.System.now().minus(1.hours).toLocalDateTime(TimeZone.UTC)
        AllianceProposals.insert {
            it[AllianceProposals.allianceId]   = allianceId
            it[AllianceProposals.proposerDrepId] = proposerDrepId
            it[proposalType]                   = "ga_stance"
            it[title]                          = "Test proposal"
            it[govActionTxHash]                = "aabb".repeat(16)
            it[govActionIndex]                 = 0
            it[status]                         = "voting"
            it[votingEndsAt]                   = ends
        }[AllianceProposals.id]
    }

    private fun seedProposalWithCustomEndsAt(
        allianceId: UUID,
        proposerDrepId: String,
        ends: kotlinx.datetime.LocalDateTime,
    ): UUID = transaction {
        AllianceProposals.insert {
            it[AllianceProposals.allianceId]   = allianceId
            it[AllianceProposals.proposerDrepId] = proposerDrepId
            it[proposalType]                   = "ga_stance"
            it[title]                          = "Expired proposal"
            it[govActionTxHash]                = "ccdd".repeat(16)
            it[govActionIndex]                 = 0
            it[status]                         = "voting"
            it[votingEndsAt]                   = ends
        }[AllianceProposals.id]
    }
}
