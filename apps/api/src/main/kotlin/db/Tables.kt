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
    val abstract     = text("abstract").nullable()
    val motivation   = text("motivation").nullable()
    val imageUrl     = text("image_url").nullable()
    val supportLinks = text("support_links").nullable()  // JSON array e.g. '["https://..."]'
    val rationale    = text("rationale").nullable()
    val votingType   = varchar("voting_type", 20)  // BASIC | SINGLE_CHOICE | MULTIPLE_CHOICE
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
    val drepId       = varchar("drep_id", 128).nullable()
    val content      = text("content")
    val createdAt    = datetime("created_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)
}

object DrepVotes : Table("drep_votes") {
    val id                = long("id").autoIncrement()
    val network           = varchar("network", 10)
    val drepCredentialHex = varchar("drep_credential_hex", 56)
    val txHash            = varchar("tx_hash", 64)
    val proposalTxHash    = varchar("proposal_tx_hash", 64)
    val proposalIndex     = integer("proposal_index")
    val vote              = varchar("vote", 10)
    val epoch             = integer("epoch")
    val slot              = long("slot")
    val voterRole         = varchar("voter_role", 8).default("drep")   // 'drep' | 'cc' | 'spo'
    val actionType        = varchar("action_type", 64).nullable()
    val anchorUrl         = text("anchor_url").nullable()
    val anchorHash        = text("anchor_hash").nullable()
    val expiresEpoch      = integer("expires_epoch").nullable()
    val votingPower       = long("voting_power").default(0)

    override val primaryKey = PrimaryKey(id)
}

object IndexerCheckpoint : Table("indexer_checkpoint") {
    val network   = varchar("network", 30)  // supports milestone keys like "mainnet_conway_genesis"
    val slot      = long("slot")
    val blockHash = varchar("block_hash", 64)

    override val primaryKey = PrimaryKey(network)
}

/**
 * Snapshot of every governance action seen by BackgroundPoller.
 * Proposals that disappear from Ogmios are marked with final status
 * (expired / enacted / dropped) so the list endpoint can return history.
 */
object GovernanceActionSnapshots : Table("governance_action_snapshots") {
    val txHash       = varchar("tx_hash", 64)
    val index        = integer("index")
    val network      = varchar("network", 10)
    val expiresEpoch = integer("expires_epoch")
    val status       = varchar("status", 32).default("active")
    val snapshotJson = text("snapshot_json")
    val firstSeenAt  = datetime("first_seen_at").defaultExpression(CurrentDateTime)
    val lastSeenAt   = datetime("last_seen_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(txHash, index, network)
}

// =============================================================================
// Chain index tables — populated by extended VoteIndexer (replaces Koios calls)
// =============================================================================

object IdxDelegationVote : Table("idx_delegation_vote") {
    val id                 = long("id").autoIncrement()
    val network            = varchar("network", 10)
    val stakeCredentialHex = varchar("stake_credential_hex", 56)
    val drepCredentialHex  = varchar("drep_credential_hex", 56).nullable()
    val drepType           = varchar("drep_type", 20)   // 'key' | 'script' | 'abstain' | 'no_confidence'
    val txHash             = varchar("tx_hash", 64)
    val slot               = long("slot")

    override val primaryKey = PrimaryKey(id)
}

object IdxPoolMetadata : Table("idx_pool_metadata") {
    val network       = varchar("network", 10)
    val poolIdBech32  = varchar("pool_id_bech32", 64)
    val poolIdHex     = varchar("pool_id_hex", 56)
    val metadataUrl   = text("metadata_url").nullable()
    val name          = text("name").nullable()
    val ticker        = varchar("ticker", 16).nullable()
    val votingPower   = long("voting_power").nullable()   // live_stake from Blockfrost, refreshed every 8 h
    val slot          = long("slot")

    override val primaryKey = PrimaryKey(network, poolIdHex)
}

/**
 * Delegator stake snapshot per DRep, populated by BackgroundPoller via Blockfrost.
 * Used to compute whale delegator counts locally (amount > 1_000_000_000_000 lovelace).
 * Refreshed every 2 hours for the top 20 DReps by delegator count.
 */
object DrepDelegatorStakes : Table("drep_delegator_stakes") {
    val network           = varchar("network", 10)
    val drepCredentialHex = varchar("drep_credential_hex", 56)
    val stakeAddress      = varchar("stake_address", 128)
    val amount            = long("amount")
    val fetchedAt         = datetime("fetched_at").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(network, drepCredentialHex, stakeAddress)
}

/**
 * Governance proposals indexed from chain-sync (Conway tx.proposals[]).
 * One row per governance action submitted on-chain.
 * Used to serve historical GAs (expired / enacted / dropped) that have left Ogmios ledger state.
 */
object IdxGovernanceProposals : Table("idx_governance_proposals") {
    val network        = varchar("network", 10)
    val txHash         = varchar("tx_hash", 64)
    val index          = integer("index")
    val actionType     = varchar("action_type", 64)
    val anchorUrl      = text("anchor_url").nullable()
    val anchorHash     = text("anchor_hash").nullable()
    val deposit        = long("deposit").default(0)
    val submittedSlot  = long("submitted_slot")
    val submittedEpoch = integer("submitted_epoch")
    val expiresEpoch   = integer("expires_epoch")
    val actionDetails  = text("action_details").nullable()  // raw Ogmios action JSON
    val returnAddress  = text("return_address").nullable()
    val title          = text("title").nullable()
    val abstract       = text("abstract").nullable()
    /** Set by backfill-enacted admin route for proposals whose real status can't be computed
     *  from epoch alone (e.g. enacted before expiry epoch). Overrides computed status. */
    val finalStatus    = varchar("final_status", 20).nullable()

    override val primaryKey = PrimaryKey(network, txHash, index)
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
