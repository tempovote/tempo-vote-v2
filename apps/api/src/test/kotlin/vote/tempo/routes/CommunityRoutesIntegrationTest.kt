package vote.tempo.routes

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.routing.routing
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assumptions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName
import vote.tempo.cache.CardanoCache
import vote.tempo.cardano.credentialHexToDrepIdCip105
import vote.tempo.db.Communities
import vote.tempo.db.InternalPolls
import vote.tempo.db.PollComments
import vote.tempo.db.PollOptions
import vote.tempo.db.PollVotes
import vote.tempo.plugins.JWT_AUDIENCE
import vote.tempo.plugins.JWT_ISSUER
import vote.tempo.plugins.JWT_SECRET
import vote.tempo.plugins.configureSecurity
import vote.tempo.plugins.configureSerialization
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.hours

/**
 * Integration tests for the community membership model (canParticipate):
 * only the DRep itself and its delegators may Create / Vote / Comment.
 *
 * Real Postgres via Testcontainers + Flyway; the route module wired exactly as in
 * production (JWT auth + JSON). The Ogmios delegation lookup is short-circuited by
 * pre-seeding CardanoCache.stakeDeleg, so no live node is required.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CommunityRoutesIntegrationTest {

    private lateinit var pg: PostgreSQLContainer<*>

    // A valid CIP-105 DRep ID that "owns" the community under test, plus an unrelated one.
    private val communityDrep = "drep182eqed5jzyh20cv6lskhf20uekww66t4t9llsg0r565zgmmhjc6"
    private val otherDrep = credentialHexToDrepIdCip105("11".repeat(28))!!

    @BeforeAll
    fun setup() {
        Assumptions.assumeTrue(
            DockerClientFactory.instance().isDockerAvailable,
            "Docker not available — skipping integration tests",
        )
        pg = PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine")).apply { start() }
        Flyway.configure().dataSource(pg.jdbcUrl, pg.username, pg.password).load().migrate()
        Database.connect(pg.jdbcUrl, driver = "org.postgresql.Driver", user = pg.username, password = pg.password)
    }

    @AfterAll
    fun teardown() {
        if (::pg.isInitialized) pg.stop()
    }

    @BeforeEach
    fun clean() {
        transaction {
            PollVotes.deleteAll()
            PollComments.deleteAll()
            PollOptions.deleteAll()
            InternalPolls.deleteAll()
            Communities.deleteAll()
        }
        CardanoCache.stakeDeleg.invalidateAll()
    }

    // ── Create poll ─────────────────────────────────────────────────────────

    @Test
    fun `owner DRep can create a poll`() {
        seedCommunity(communityDrep, active = true)
        runApp {
            val res = createPoll(communityDrep, jwt("stake_test1owner", drepId = communityDrep))
            assertEquals(HttpStatusCode.Created, res.status)
        }
    }

    @Test
    fun `delegator of the DRep can create a poll`() {
        seedCommunity(communityDrep, active = true)
        seedDelegation("stake_test1deleg", delegatedTo = communityDrep)
        runApp {
            // jwt drepId is a different DRep (owner check fails) — only the delegation lets them in.
            val res = createPoll(communityDrep, jwt("stake_test1deleg", drepId = otherDrep))
            assertEquals(HttpStatusCode.Created, res.status)
        }
    }

    @Test
    fun `outsider (neither owner nor delegator) cannot create a poll`() {
        seedCommunity(communityDrep, active = true)
        seedDelegation("stake_test1out", delegatedTo = null) // delegated to nobody
        runApp {
            val res = createPoll(communityDrep, jwt("stake_test1out", drepId = otherDrep))
            assertEquals(HttpStatusCode.Forbidden, res.status)
        }
    }

    @Test
    fun `cannot create a poll in an inactive community (even as owner)`() {
        seedCommunity(communityDrep, active = false)
        runApp {
            val res = createPoll(communityDrep, jwt("stake_test1owner", drepId = communityDrep))
            assertEquals(HttpStatusCode.Forbidden, res.status)
        }
    }

    // ── Vote ────────────────────────────────────────────────────────────────

    @Test
    fun `member can vote, outsider cannot`() {
        val communityId = seedCommunity(communityDrep, active = true)
        val (pollId, optionId) = seedPoll(communityId)
        seedDelegation("stake_test1out", delegatedTo = null)

        runApp {
            val ok = castVote(pollId, optionId, jwt("stake_test1owner", drepId = communityDrep))
            assertEquals(HttpStatusCode.Created, ok.status)

            val denied = castVote(pollId, optionId, jwt("stake_test1out", drepId = otherDrep))
            assertEquals(HttpStatusCode.Forbidden, denied.status)
        }
    }

    // ── Comment ───────────────────────────────────────────────────────────────

    @Test
    fun `member can comment, outsider cannot`() {
        val communityId = seedCommunity(communityDrep, active = true)
        val (pollId, _) = seedPoll(communityId)
        seedDelegation("stake_test1deleg", delegatedTo = communityDrep)
        seedDelegation("stake_test1out", delegatedTo = null)

        runApp {
            val ok = comment(pollId, jwt("stake_test1deleg", drepId = otherDrep))
            assertEquals(HttpStatusCode.Created, ok.status)

            val denied = comment(pollId, jwt("stake_test1out", drepId = otherDrep))
            assertEquals(HttpStatusCode.Forbidden, denied.status)
        }
    }

    // ── Harness ─────────────────────────────────────────────────────────────

    private fun runApp(block: suspend ApplicationTestBuilder.() -> Unit) = testApplication {
        application {
            configureSerialization()
            configureSecurity()
            routing { communityRoutes() }
        }
        block()
    }

    private fun jwt(stake: String, network: String = "preprod", drepId: String? = null): String =
        JWT.create()
            .withIssuer(JWT_ISSUER)
            .withAudience(JWT_AUDIENCE)
            .withSubject(stake)
            .withClaim("network", network)
            .apply { if (drepId != null) withClaim("drepId", drepId) }
            .sign(Algorithm.HMAC256(JWT_SECRET))

    private suspend fun ApplicationTestBuilder.createPoll(drepId: String, token: String): HttpResponse {
        val now = java.time.Instant.now()
        val body = """
            {"network":"preprod","title":"Integration poll",
             "startsAt":"${now.minusSeconds(3600)}","endsAt":"${now.plusSeconds(86400)}"}
        """.trimIndent()
        return client.post("/communities/$drepId/polls") {
            bearerAuth(token); contentType(ContentType.Application.Json); setBody(body)
        }
    }

    private suspend fun ApplicationTestBuilder.castVote(pollId: UUID, optionId: UUID, token: String): HttpResponse =
        client.post("/communities/polls/$pollId/vote") {
            bearerAuth(token); contentType(ContentType.Application.Json); setBody("""{"optionId":"$optionId"}""")
        }

    private suspend fun ApplicationTestBuilder.comment(pollId: UUID, token: String): HttpResponse =
        client.post("/communities/polls/$pollId/comments") {
            bearerAuth(token); contentType(ContentType.Application.Json); setBody("""{"content":"hello"}""")
        }

    private fun seedCommunity(drepId: String, active: Boolean): UUID = transaction {
        Communities.insert {
            it[Communities.drepId] = drepId
            it[network] = "preprod"
            it[isActive] = active
        }[Communities.id]
    }

    private fun seedPoll(communityId: UUID): Pair<UUID, UUID> = transaction {
        val now = Clock.System.now()
        val pollId = InternalPolls.insert {
            it[InternalPolls.communityId] = communityId
            it[title] = "Seed poll"
            it[votingType] = "BASIC"
            it[startEpoch] = 0
            it[startsAt] = now.minus(1.hours).toLocalDateTime(TimeZone.UTC)
            it[endsAt] = now.plus(1.days).toLocalDateTime(TimeZone.UTC)
        }[InternalPolls.id]
        val optionId = PollOptions.insert {
            it[PollOptions.pollId] = pollId
            it[text] = "Yes"
            it[order] = 0
        }[PollOptions.id]
        pollId to optionId
    }

    /** Pre-seed the delegation cache so canParticipate skips the live Ogmios lookup. */
    private fun seedDelegation(stake: String, delegatedTo: String?) {
        val response = if (delegatedTo == null) {
            buildJsonObject { put("delegatedDrep", JsonNull) }
        } else {
            buildJsonObject { putJsonObject("delegatedDrep") { put("id", delegatedTo); put("name", JsonNull) } }
        }
        CardanoCache.stakeDeleg.put("PREPROD:$stake", response)
    }
}
