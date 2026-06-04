package vote.tempo.cardano

import com.bloxbean.cardano.client.address.Credential
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
import com.bloxbean.cardano.client.util.HexUtil

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
    fun buildDRepRegister(
        changeAddress: String,
        rewardAddress: String,
        drepId: String,
        anchorUrl: String,
        anchorDataHash: String,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val drepCredential = drepIdToCredential(drepId)

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

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

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
     * Complete the transaction WITHOUT signing — returns unsigned CBOR hex.
     * The frontend is responsible for signing via wallet.signTx().
     */
    private fun buildUnsigned(tx: Tx, changeAddress: String): String {
        val quickTxBuilder = QuickTxBuilder(backendService)
        val transaction = quickTxBuilder
            .compose(tx)
            .feePayer(changeAddress)
            .build()
        // Return the transaction CBOR hex
        return transaction.serializeToHex()
    }
}
