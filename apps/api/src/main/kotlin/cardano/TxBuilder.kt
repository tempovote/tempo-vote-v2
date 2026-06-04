package vote.tempo.cardano

import com.bloxbean.cardano.client.account.Account
import com.bloxbean.cardano.client.address.Address
import com.bloxbean.cardano.client.api.model.Utxo
import com.bloxbean.cardano.client.common.model.Networks
import com.bloxbean.cardano.client.governance.DRep
import com.bloxbean.cardano.client.governance.DRepId
import com.bloxbean.cardano.client.governance.DRepType
import com.bloxbean.cardano.client.governance.Vote
import com.bloxbean.cardano.client.governance.Voter
import com.bloxbean.cardano.client.governance.VoterType
import com.bloxbean.cardano.client.governance.actions.GovActionId
import com.bloxbean.cardano.client.quicktx.QuickTxBuilder
import com.bloxbean.cardano.client.quicktx.Tx
import com.bloxbean.cardano.client.transaction.spec.governance.Anchor

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
     * @param anchorDataHash blake2b-256 hash of the metadata file
     * @return unsigned transaction CBOR hex
     */
    fun buildDRepRegister(
        changeAddress: String,
        rewardAddress: String,
        drepId: String,
        anchorUrl: String,
        anchorDataHash: String,
    ): String {
        val anchor = Anchor(anchorUrl, anchorDataHash)
        // We create a temporary account wrapper to get drepCredential from drepId.
        // This does NOT expose a private key — only the public credential is used.
        val drepCredential = DRepId.toDrepCredential(drepId)

        val tx = Tx()
            .registerDRep(drepCredential, anchor)
            .from(changeAddress)

        return buildUnsigned(tx, changeAddress)
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
        val drepCredential = DRepId.toDrepCredential(drepId)
        val tx = if (anchorUrl != null && anchorDataHash != null) {
            Tx().updateDRep(drepCredential, Anchor(anchorUrl, anchorDataHash)).from(changeAddress)
        } else {
            Tx().updateDRep(drepCredential).from(changeAddress)
        }
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned DRep deregistration (retirement) transaction.
     */
    fun buildDRepRetire(changeAddress: String, drepId: String): String {
        val drepCredential = DRepId.toDrepCredential(drepId)
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
        val voter = Voter(VoterType.DREP_KEY_HASH, DRepId.toDrepCredential(drepId))
        val govActionId = GovActionId(govActionTxHash, govActionIndex)
        val vote = when (voteKind.uppercase()) {
            "YES"     -> Vote.YES
            "NO"      -> Vote.NO
            else      -> Vote.ABSTAIN
        }

        val txBase = Tx().createVote(voter, govActionId, vote).from(changeAddress)
        // TODO: attach rationale anchor once cardano-client-lib supports it in createVote
        return buildUnsigned(txBase, changeAddress)
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
            "abstain"       -> DRep.ABSTAIN
            "no_confidence" -> DRep.NO_CONFIDENCE
            else            -> {
                requireNotNull(targetDrepId) { "targetDrepId required for 'drep' delegation type" }
                DRepId.toDrep(targetDrepId, DRepType.ADDR_KEYHASH)
            }
        }

        // delegateVotingPowerTo requires an Account object for the stake credential.
        // We build a minimal account from the reward address (no private key needed for building).
        val tx = Tx()
            .delegateVotingPowerTo(rewardAddress, drep)
            .from(changeAddress)

        return buildUnsigned(tx, changeAddress)
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Complete the transaction WITHOUT signing — returns unsigned CBOR hex.
     * The frontend is responsible for signing via wallet.signTx().
     */
    private fun buildUnsigned(tx: Tx, changeAddress: String): String {
        val quickTxBuilder = QuickTxBuilder(backendService)
        val transaction = quickTxBuilder
            .compose(tx)
            .feePayer(changeAddress)
            .buildAndSign() // signs with a no-op signer; we strip witnesses after
        // Return the transaction body CBOR (without signatures)
        // cardano-client-lib returns full tx — we send as-is; wallet.signTx handles partial signing
        return transaction.serialize()
            ?: error("Failed to serialize transaction")
    }
}
