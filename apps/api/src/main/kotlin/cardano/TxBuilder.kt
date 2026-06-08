package vote.tempo.cardano

import com.bloxbean.cardano.client.address.Credential
import com.bloxbean.cardano.client.api.model.Amount
import com.bloxbean.cardano.client.common.model.Networks
import com.bloxbean.cardano.client.governance.LegacyDRepId
import com.bloxbean.cardano.client.quicktx.QuickTxBuilder
import com.bloxbean.cardano.client.quicktx.Tx
import com.bloxbean.cardano.client.transaction.spec.governance.Anchor
import com.bloxbean.cardano.client.transaction.spec.governance.DRep
import com.bloxbean.cardano.client.transaction.spec.governance.DRepType
import com.bloxbean.cardano.client.transaction.spec.governance.Vote
import com.bloxbean.cardano.client.transaction.spec.governance.Voter
import com.bloxbean.cardano.client.transaction.spec.governance.VoterType
import com.bloxbean.cardano.client.transaction.spec.governance.actions.GovActionId
import com.bloxbean.cardano.client.transaction.spec.governance.Constitution
import com.bloxbean.cardano.client.transaction.spec.governance.actions.HardForkInitiationAction
import com.bloxbean.cardano.client.transaction.spec.governance.actions.InfoAction
import com.bloxbean.cardano.client.transaction.spec.governance.actions.NewConstitution
import com.bloxbean.cardano.client.transaction.spec.governance.actions.NoConfidence
import com.bloxbean.cardano.client.transaction.spec.governance.actions.TreasuryWithdrawalsAction
import com.bloxbean.cardano.client.transaction.spec.governance.actions.UpdateCommittee
import com.bloxbean.cardano.client.transaction.spec.ProtocolVersion
import com.bloxbean.cardano.client.transaction.spec.Withdrawal
import com.bloxbean.cardano.client.spec.UnitInterval
import com.bloxbean.cardano.client.util.HexUtil
import java.math.BigInteger

/**
 * TxBuilder — wraps cardano-client-lib QuickTx API for governance transactions.
 *
 * IMPORTANT: These functions build UNSIGNED transactions and return the CBOR hex.
 * The frontend passes the CBOR to wallet.signTx(), then submits via /tx/submit.
 *
 * The `utxos` and `changeAddress` come from the wallet (CIP-30), not from Kupo,
 * so the user's wallet UTxOs are always up to date.
 */
class TxBuilder(private val network: Network) {

    private val backendService = getBackendService(network)
    private val cardanoNetwork = if (network == Network.MAINNET) Networks.mainnet() else Networks.preprod()

    /**
     * Build an unsigned DRep registration transaction.
     * @param changeAddress  bech32 payment address from wallet
     * @param rewardAddress  bech32 stake/reward address from wallet
     * @param drepId         CIP-105 DRep ID from wallet.cip95.getDRepKey()
     * @param anchorUrl      URL to CIP-119 metadata JSON-LD on IPFS
     * @param anchorDataHash blake2b-256 hash of the metadata file (hex)
     * @return unsigned transaction CBOR hex
     */
    /**
     * @param selfDelegate if true, includes a VoteDelegCert to self in the same TX (atomic).
     *   This avoids the double-spent / unconfirmed-DRep issues of submitting two separate TXs.
     */
    fun buildDRepRegister(
        changeAddress: String,
        rewardAddress: String,
        drepId: String,
        anchorUrl: String,
        anchorDataHash: String,
        selfDelegate: Boolean = false,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val drepCredential = drepIdToCredential(drepId)

        var tx = Tx().registerDRep(drepCredential, anchor)
        if (selfDelegate) {
            val selfDrep = LegacyDRepId.toDrep(drepId, DRepType.ADDR_KEYHASH)
            tx = tx.delegateVotingPowerTo(rewardAddress, selfDrep)
        }

        return buildUnsigned(tx.from(changeAddress), changeAddress)
    }

    /**
     * Build an unsigned DRep update transaction (update metadata anchor).
     */
    fun buildDRepUpdate(
        changeAddress: String,
        drepId: String,
        anchorUrl: String?,
        anchorDataHash: String?,
    ): String {
        val drepCredential = drepIdToCredential(drepId)
        val tx = if (anchorUrl != null && anchorDataHash != null) {
            Tx().updateDRep(drepCredential, Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))).from(changeAddress)
        } else {
            Tx().updateDRep(drepCredential).from(changeAddress)
        }
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned DRep deregistration (retirement) transaction.
     */
    fun buildDRepRetire(changeAddress: String, drepId: String): String {
        val drepCredential = drepIdToCredential(drepId)
        val tx = Tx()
            .unregisterDRep(drepCredential)
            .from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned vote transaction on a governance action.
     * @param voteKind  "YES" | "NO" | "ABSTAIN"
     * @param rationale optional — { anchorUrl, anchorDataHash } for vote rationale
     */
    fun buildVote(
        changeAddress: String,
        drepId: String,
        govActionTxHash: String,
        govActionIndex: Int,
        voteKind: String,
        rationaleUrl: String? = null,
        rationaleHash: String? = null,
    ): String {
        val voter = Voter(VoterType.DREP_KEY_HASH, drepIdToCredential(drepId))
        val govActionId = GovActionId(govActionTxHash, govActionIndex)
        val vote = when (voteKind.uppercase()) {
            "YES"     -> Vote.YES
            "NO"      -> Vote.NO
            else      -> Vote.ABSTAIN
        }

        val tx = if (rationaleUrl != null && rationaleHash != null) {
            val anchor = Anchor(rationaleUrl, HexUtil.decodeHexString(rationaleHash))
            Tx().createVote(voter, govActionId, vote, anchor).from(changeAddress)
        } else {
            Tx().createVote(voter, govActionId, vote).from(changeAddress)
        }
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned delegation transaction (delegate voting power to a DRep).
     * @param targetDrepId  DRep ID to delegate to (null = alwaysAbstain or alwaysNoConfidence)
     * @param delegationType "drep" | "abstain" | "no_confidence"
     */
    fun buildDelegation(
        changeAddress: String,
        rewardAddress: String,
        delegationType: String,
        targetDrepId: String? = null,
    ): String {
        val drep: DRep = when (delegationType.lowercase()) {
            "abstain"       -> DRep.abstain()
            "no_confidence" -> DRep.noConfidence()
            else            -> {
                requireNotNull(targetDrepId) { "targetDrepId required for 'drep' delegation type" }
                LegacyDRepId.toDrep(targetDrepId, DRepType.ADDR_KEYHASH)
            }
        }

        val tx = Tx()
            .delegateVotingPowerTo(rewardAddress, drep)
            .from(changeAddress)

        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned Info Action governance proposal transaction.
     * @param rewardAddress bech32 stake address — deposit is returned here when action expires
     * @param anchorUrl     CIP-108 metadata URL on IPFS
     * @param anchorDataHash blake2b-256 hash of the metadata file (hex)
     */
    fun buildInfoAction(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val tx = Tx()
            .createProposal(InfoAction.builder().build(), rewardAddress, anchor)
            .from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned No Confidence governance proposal.
     * @param prevGovActionTxHash optional — tx hash of the last enacted committee action
     * @param prevGovActionIdx    optional — index of the last enacted committee action
     */
    fun buildNoConfidence(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
        prevGovActionTxHash: String? = null,
        prevGovActionIdx: Int? = null,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val prevId = buildPrevGovActionId(prevGovActionTxHash, prevGovActionIdx)
        val action = NoConfidence.builder().prevGovActionId(prevId).build()
        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned Hard Fork Initiation governance proposal.
     * @param protocolVersionMajor target Conway protocol major version (e.g. 10)
     * @param protocolVersionMinor target Conway protocol minor version (e.g. 0)
     */
    fun buildHardFork(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
        protocolVersionMajor: Int,
        protocolVersionMinor: Int,
        prevGovActionTxHash: String? = null,
        prevGovActionIdx: Int? = null,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val prevId = buildPrevGovActionId(prevGovActionTxHash, prevGovActionIdx)
        val action = HardForkInitiationAction.builder()
            .prevGovActionId(prevId)
            .protocolVersion(ProtocolVersion(protocolVersionMajor, protocolVersionMinor))
            .build()
        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned New Constitution governance proposal.
     * @param constitutionAnchorUrl  URL of the constitution document (IPFS or HTTPS)
     * @param constitutionAnchorHash blake2b-256 hash of the constitution document (hex)
     * @param constitutionScriptHash optional guardrails script hash (28-byte hex)
     */
    fun buildNewConstitution(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
        constitutionAnchorUrl: String,
        constitutionAnchorHash: String,
        constitutionScriptHash: String? = null,
        prevGovActionTxHash: String? = null,
        prevGovActionIdx: Int? = null,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val prevId = buildPrevGovActionId(prevGovActionTxHash, prevGovActionIdx)
        val constitutionAnchor = Anchor(constitutionAnchorUrl, HexUtil.decodeHexString(constitutionAnchorHash))
        val constitution = Constitution.builder()
            .anchor(constitutionAnchor)
            .scripthash(constitutionScriptHash)
            .build()
        val action = NewConstitution.builder()
            .prevGovActionId(prevId)
            .constitution(constitution)
            .build()
        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned Treasury Withdrawal governance proposal.
     * @param withdrawals list of (bech32 stake address, lovelace amount) pairs
     */
    suspend fun buildTreasuryWithdrawal(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
        withdrawals: List<Pair<String, BigInteger>>,
    ): String {
        require(withdrawals.isNotEmpty()) { "treasuryWithdrawals must not be empty" }
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        // Constitution guardrails hash is required when the current constitution defines one.
        // Omitting it (null) causes a ledger rejection with error code 3163.
        val guardrailsHash = OgmiosStateQueries(network).getConstitutionGuardrailsHash()
        val action = TreasuryWithdrawalsAction.builder()
            .withdrawals(withdrawals.map { (addr, lovelace) ->
                Withdrawal.builder().rewardAddress(addr).coin(lovelace).build()
            })
            .policyHash(guardrailsHash)
            .build()
        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned Update Committee governance proposal.
     * @param membersToRemove  bech32 cc_cold / cc_cold_test credentials (or raw hex) to remove
     * @param membersToAdd     list of (credential, termEpoch) pairs for new members
     * @param quorumNumerator  numerator of the new quorum threshold
     * @param quorumDenominator denominator of the new quorum threshold (e.g. 2/3 = 67%)
     */
    fun buildUpdateCommittee(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
        membersToRemove: List<String>,
        membersToAdd: List<Pair<String, Int>>,
        quorumNumerator: Long,
        quorumDenominator: Long,
        prevGovActionTxHash: String? = null,
        prevGovActionIdx: Int? = null,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val prevId = buildPrevGovActionId(prevGovActionTxHash, prevGovActionIdx)
        val removeSet = LinkedHashSet(membersToRemove.map { parseCcCredential(it) })
        val addMap = LinkedHashMap<Credential, Int>().apply {
            membersToAdd.forEach { (cred, epoch) -> put(parseCcCredential(cred), epoch) }
        }
        val quorum = UnitInterval(BigInteger.valueOf(quorumNumerator), BigInteger.valueOf(quorumDenominator))
        val action = UpdateCommittee.builder()
            .prevGovActionId(prevId)
            .membersForRemoval(removeSet)
            .newMembersAndTerms(addMap)
            .quorumThreshold(quorum)
            .build()
        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private fun buildPrevGovActionId(txHash: String?, index: Int?): GovActionId? =
        if (txHash != null && index != null) GovActionId(txHash, index) else null

    /**
     * Convert a DRep ID (bech32 drep_...) or hex key hash to a Credential.
     */
    private fun drepIdToCredential(drepId: String): Credential {
        // If it starts with "drep", it's bech32 — decode to get the key hash
        // Otherwise treat as raw hex key hash
        return if (drepId.startsWith("drep")) {
            val hash = com.bloxbean.cardano.client.crypto.Bech32.decode(drepId).data
            Credential.fromKey(hash)
        } else {
            Credential.fromKey(drepId)
        }
    }

    /**
     * Parse a CC cold credential from bech32 (cc_cold1..., cc_cold_test1...,
     * cc_cold_script1..., cc_cold_script_test1...) or raw hex key hash.
     */
    private fun parseCcCredential(credential: String): Credential {
        val trimmed = credential.trim()
        return when {
            trimmed.startsWith("cc_cold_script") -> {
                val hash = com.bloxbean.cardano.client.crypto.Bech32.decode(trimmed).data
                Credential.fromScript(hash)
            }
            trimmed.startsWith("cc_cold") -> {
                val hash = com.bloxbean.cardano.client.crypto.Bech32.decode(trimmed).data
                Credential.fromKey(hash)
            }
            else -> Credential.fromKey(HexUtil.decodeHexString(trimmed))
        }
    }

    /**
     * Build a simple ADA payment transaction (e.g. platform fee).
     */
    fun buildPayment(
        changeAddress: String,
        toAddress: String,
        lovelace: Long,
    ): String {
        val tx = Tx()
            .payToAddress(toAddress, Amount.lovelace(BigInteger.valueOf(lovelace)))
            .from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Complete the transaction WITHOUT signing — returns unsigned CBOR hex.
     * The frontend is responsible for signing via wallet.signTx().
     */
    private fun buildUnsigned(tx: Tx, changeAddress: String): String {
        val quickTxBuilder = QuickTxBuilder(backendService)
        val transaction = quickTxBuilder
            .compose(tx)
            .feePayer(changeAddress)
            .build()

        // QuickTxBuilder estimates fee assuming 1 VKey witness, but governance TXs need 2
        // (payment key + DRep cert key). Pad fee by 10,000 lovelace (~100 bytes margin)
        // so Ogmios doesn't reject with "Insufficient fee".
        val padding = BigInteger.valueOf(10_000L)
        val body = transaction.body
        body.fee = body.fee.add(padding)
        body.outputs.firstOrNull { it.address == changeAddress }?.let { changeOut ->
            if (changeOut.value.coin >= padding) {
                changeOut.value.coin = changeOut.value.coin.subtract(padding)
            }
        }

        val certCount = transaction.body.certs?.size ?: 0
        println("[TxBuilder] Built TX: certs=$certCount fee=${transaction.body.fee}")
        transaction.body.certs?.forEachIndexed { i, cert ->
            println("[TxBuilder]   cert[$i] = ${cert.javaClass.simpleName}")
        }
        return transaction.serializeToHex()
    }
}
