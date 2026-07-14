package vote.tempo.db

import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.junit.jupiter.api.Assumptions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import vote.tempo.cardano.DRepVoteStats
import vote.tempo.cardano.GovernanceActionDto
import vote.tempo.cardano.SPOVoteStats
import vote.tempo.cardano.VoteCounts
import vote.tempo.testutil.TestDatabase
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/**
 * upsertGaTitle must persist a resolved title whether or not VoteIndexer has already indexed
 * the proposal. Live GAs whose submission tx predates the indexer checkpoint have no row in
 * idx_governance_proposals — before the insert-if-missing behavior, their titles were silently
 * dropped (UPDATE matched 0 rows) and refetched from IPFS on every request.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ChainIndexDaoTest {

    @BeforeAll
    fun setup() {
        Assumptions.assumeTrue(TestDatabase.isDockerAvailable, "Docker not available — skipping integration tests")
        TestDatabase.setup()
    }

    @BeforeEach
    fun clean() {
        transaction { IdxGovernanceProposals.deleteAll() }
    }

    private fun gaDto(txHash: String, index: Int = 0) = GovernanceActionDto(
        txHash       = txHash,
        index        = index,
        type         = "Info Action",
        actionType   = "information",
        anchorUrl    = "ipfs://QmTest",
        anchorHash   = "ab".repeat(32),
        expiresEpoch = 500,
        deposit      = 100_000_000_000L,
        drepVotes    = DRepVoteStats(0, 0, 0, 0L, 0L, 0L, 0L, 0L, 0L),
        spoVotes     = SPOVoteStats(0, 0, 0),
        ccVotes      = VoteCounts(0, 0, 0),
    )

    @Test
    fun `inserts stub row when proposal is not indexed yet`() {
        val tx = "aa".repeat(32)
        ChainIndexDao.upsertGaTitle("preprod", gaDto(tx), "Resolved Title", "An abstract")

        val row = transaction {
            IdxGovernanceProposals.selectAll()
                .where { (IdxGovernanceProposals.network eq "preprod") and (IdxGovernanceProposals.txHash eq tx) }
                .single()
        }
        assertEquals("Resolved Title", row[IdxGovernanceProposals.title])
        assertEquals("An abstract", row[IdxGovernanceProposals.abstract])
        assertEquals("information", row[IdxGovernanceProposals.actionType])
        assertEquals("ipfs://QmTest", row[IdxGovernanceProposals.anchorUrl])
        assertEquals(500, row[IdxGovernanceProposals.expiresEpoch])
        assertEquals(0L, row[IdxGovernanceProposals.submittedSlot])
    }

    @Test
    fun `updates existing indexed row without touching chain fields`() {
        val tx = "bb".repeat(32)
        transaction {
            IdxGovernanceProposals.insert {
                it[network]        = "preprod"
                it[txHash]         = tx
                it[index]          = 0
                it[actionType]     = "treasuryWithdrawals"
                it[deposit]        = 42L
                it[submittedSlot]  = 123_456L
                it[submittedEpoch] = 400
                it[expiresEpoch]   = 406
            }
        }

        ChainIndexDao.upsertGaTitle("preprod", gaDto(tx), "New Title", null)

        val row = transaction {
            IdxGovernanceProposals.selectAll()
                .where { (IdxGovernanceProposals.network eq "preprod") and (IdxGovernanceProposals.txHash eq tx) }
                .single()
        }
        assertEquals("New Title", row[IdxGovernanceProposals.title])
        // Chain fields from the indexer must survive — upsertGaTitle only sets title/abstract on update.
        assertEquals(123_456L, row[IdxGovernanceProposals.submittedSlot])
        assertEquals("treasuryWithdrawals", row[IdxGovernanceProposals.actionType])
        assertEquals(42L, row[IdxGovernanceProposals.deposit])
    }

    @Test
    fun `persisted title is served by buildGaTitleMap`() {
        val tx = "cc".repeat(32)
        ChainIndexDao.upsertGaTitle("preprod", gaDto(tx), "Mapped Title", null)

        val map = ChainIndexDao.buildGaTitleMap("preprod")
        assertNotNull(map["$tx#0"])
        assertEquals("Mapped Title", map["$tx#0"])
    }
}
