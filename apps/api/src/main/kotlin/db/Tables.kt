package vote.tempo.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.datetime
import org.jetbrains.exposed.sql.kotlin.datetime.CurrentDateTime

// =============================================================================
// Off-chain tables — on-chain data is always fetched from Ogmios/Kupo
// =============================================================================

object DRepProfiles : Table("drep_profiles") {
    val id        = varchar("id", 128)      // DRep ID on-chain (CIP-105)
    val network   = varchar("network", 10)  // "preprod" | "mainnet"
    val createdAt = datetime("created_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id, network)
}

object Communities : Table("communities") {
    val id          = uuid("id").autoGenerate()
    val drepId      = varchar("drep_id", 128)
    val network     = varchar("network", 10)
    val isActive    = bool("is_active").default(false)
    val activatedAt = datetime("activated_at").nullable()

    override val primaryKey = PrimaryKey(id)
    init { uniqueIndex(drepId, network) }
}

object InternalPolls : Table("internal_polls") {
    val id          = uuid("id").autoGenerate()
    val communityId = uuid("community_id").references(Communities.id)
    val title       = varchar("title", 255)
    val abstract    = text("abstract").nullable()
    val votingType  = varchar("voting_type", 20)  // BASIC | SINGLE_CHOICE | MULTIPLE_CHOICE
    val startEpoch  = integer("start_epoch")        // voting power snapshot epoch
    val startsAt    = datetime("starts_at")
    val endsAt      = datetime("ends_at")
    val createdAt   = datetime("created_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)
}

object PollOptions : Table("poll_options") {
    val id      = uuid("id").autoGenerate()
    val pollId  = uuid("poll_id").references(InternalPolls.id)
    val text    = varchar("text", 100)   // "Yes"/"No"/"Abstain" or custom
    val order   = integer("order").default(0)

    override val primaryKey = PrimaryKey(id)
}

object PollVotes : Table("poll_votes") {
    val id           = uuid("id").autoGenerate()
    val pollId       = uuid("poll_id").references(InternalPolls.id)
    val optionId     = uuid("option_id").references(PollOptions.id)
    val stakeAddress = varchar("stake_address", 128)
    val votingPower  = long("voting_power")   // ADA in lovelace at start_epoch
    val createdAt    = datetime("created_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)
    init { uniqueIndex(pollId, stakeAddress) }
}

object PollComments : Table("poll_comments") {
    val id           = uuid("id").autoGenerate()
    val pollId       = uuid("poll_id").references(InternalPolls.id)
    val stakeAddress = varchar("stake_address", 128)
    val content      = text("content")
    val createdAt    = datetime("created_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)
}

object AuthSessions : Table("auth_sessions") {
    val id           = uuid("id").autoGenerate()
    val stakeAddress = varchar("stake_address", 128)
    val network      = varchar("network", 10)
    val nonce        = varchar("nonce", 64)
    val createdAt    = datetime("created_at").defaultExpression(CurrentDateTime)
    val expiresAt    = datetime("expires_at")

    override val primaryKey = PrimaryKey(id)
}
