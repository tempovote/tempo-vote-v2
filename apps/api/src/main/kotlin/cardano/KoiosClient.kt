package vote.tempo.cardano

// All Koios API calls have been replaced by local DB indexers:
//   - Pool info (name, voting_power) → Blockfrost pool stake indexer → idx_pool_metadata
//   - Vote rationale URLs            → VoteIndexer (chain-sync)      → drep_votes.anchor_url
//   - DRep delegator counts          → Ogmios delegateRepresentatives → CardanoCache
//   - Whale delegator stakes         → Blockfrost delegator indexer  → drep_delegator_stakes
//
// This file is intentionally empty.
// PoolInfo and extractSPOPoolIds were moved to GovernanceActionDto.kt.
