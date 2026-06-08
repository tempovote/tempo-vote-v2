package vote.tempo.cardano

import com.bloxbean.cardano.client.address.Credential
import com.bloxbean.cardano.client.api.model.Amount
import com.bloxbean.cardano.client.api.util.CostModelUtil
import com.bloxbean.cardano.client.common.model.Networks
import com.bloxbean.cardano.client.governance.LegacyDRepId
import com.bloxbean.cardano.client.plutus.spec.ConstrPlutusData
import com.bloxbean.cardano.client.plutus.spec.CostMdls
import com.bloxbean.cardano.client.plutus.spec.ExUnits
import com.bloxbean.cardano.client.plutus.spec.Language
import com.bloxbean.cardano.client.plutus.spec.ListPlutusData
import com.bloxbean.cardano.client.plutus.spec.PlutusData
import com.bloxbean.cardano.client.plutus.spec.PlutusV3Script
import com.bloxbean.cardano.client.plutus.spec.Redeemer
import com.bloxbean.cardano.client.plutus.spec.RedeemerTag
import com.bloxbean.cardano.client.plutus.util.ScriptDataHashGenerator
import com.bloxbean.cardano.client.quicktx.AbstractTx
import com.bloxbean.cardano.client.quicktx.QuickTxBuilder
import com.bloxbean.cardano.client.quicktx.Tx
import com.bloxbean.cardano.client.spec.Era
import com.bloxbean.cardano.client.transaction.spec.TransactionInput
import com.bloxbean.cardano.client.transaction.spec.TransactionWitnessSet
import co.nstant.`in`.cbor.CborDecoder as CborDecoderLib
import co.nstant.`in`.cbor.model.Array as CborArray
import co.nstant.`in`.cbor.model.ByteString as CborByteString
import co.nstant.`in`.cbor.model.UnsignedInteger as CborUInt
import java.io.ByteArrayInputStream
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
        collateral: List<String> = emptyList(),
    ): String {
        require(withdrawals.isNotEmpty()) { "treasuryWithdrawals must not be empty" }
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val ogmios = OgmiosStateQueries(network)
        // Constitution guardrails hash is required by ledger (error 3163 if missing/wrong).
        val guardrailsHash = ogmios.getConstitutionGuardrailsHash()
        val action = TreasuryWithdrawalsAction.builder()
            .withdrawals(withdrawals.map { (addr, lovelace) ->
                Withdrawal.builder().rewardAddress(addr).coin(lovelace).build()
            })
            .policyHash(guardrailsHash)
            .build()

        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)

        if (guardrailsHash != null) {
            val scriptHex = ogmios.getConstitutionScriptHex()
            if (scriptHex != null) {
                return buildUnsignedWithGuardrailsScript(tx, changeAddress, scriptHex, collateral)
            }
        }

        return buildUnsigned(tx, changeAddress)
    }

    private fun buildUnsignedWithGuardrailsScript(tx: Tx, changeAddress: String, scriptHex: String, collateral: List<String> = emptyList()): String {
        val quickTxBuilder = QuickTxBuilder(backendService)
        val transaction = quickTxBuilder
            .compose(tx)
            .feePayer(changeAddress)
            .build()

        println("[TxBuilder] scriptHex length=${scriptHex.length}, prefix=${scriptHex.take(12)}")

        // Add guardrails script to witness set — no redeemer, no script integrity hash.
        // The script is validated at ratification time, not at submission.
        //
        // Double-encoding: Kupo returns scriptHex as Level-2 CBOR (590851...flat_bytes).
        // The ledger hashes the CONTENT of the bytes item in the witness, so the bytes item
        // must contain `590851flat_bytes` (Level-2) as its content for the hash to equal
        // fa24fb... = blake2b-224(0x03 || 590851flat_bytes).
        //
        // PlutusV3Script.serializeAsDataItem() CBOR-decodes cborHex → inner ByteString →
        // serialises it back as a CBOR bytes item. So we wrap scriptHex in one more
        // CBOR bytestring header so the final witness item carries the Level-2 bytes.
        val scriptBytesLen = scriptHex.length / 2          // 2132 bytes
        val lenHex = "%04x".format(scriptBytesLen)         // "0854"
        val doubleCborHex = "59$lenHex$scriptHex"          // bytes(2132, 590851flat_bytes)
        val plutusScript = PlutusV3Script.builder().cborHex(doubleCborHex).build()
        // Redeemer for "propose" purpose (tag 5) — the guardrails script is executed at submission
        // time for governance proposals. Index 0 = first (only) proposal in this TX.
        // Redeemer data: unit () = Constr 0 [] = d87980 (standard for guardrails scripts).
        // ExUnits: generous budget; actual usage is far less for a simple validation script.
        val redeemer = Redeemer.builder()
            .tag(RedeemerTag.Proposing)
            .index(0)
            .data(ConstrPlutusData.builder().data(ListPlutusData.of()).build())
            .exUnits(ExUnits.builder()
                .mem(BigInteger.valueOf(1_000_000L))
                .steps(BigInteger.valueOf(1_000_000_000L))
                .build())
            .build()

        val ws = transaction.witnessSet ?: TransactionWitnessSet()
        ws.plutusV3Scripts = (ws.plutusV3Scripts ?: emptyList()) + listOf(plutusScript)
        ws.redeemers = (ws.redeemers ?: emptyList()) + listOf(redeemer)
        transaction.witnessSet = ws

        // Collateral inputs — forfeited if script execution fails (ledger requires ≥1 for Plutus TXs)
        if (collateral.isNotEmpty()) {
            val collateralInputs = collateral.mapNotNull { utxoCbor ->
                runCatching {
                    val items = CborDecoderLib(ByteArrayInputStream(HexUtil.decodeHexString(utxoCbor))).decode()
                    val utxoArr = items.first() as CborArray
                    val inputArr = utxoArr.dataItems[0] as CborArray
                    val txHash = HexUtil.encodeHexString((inputArr.dataItems[0] as CborByteString).bytes)
                    val txIndex = (inputArr.dataItems[1] as CborUInt).value.toInt()
                    TransactionInput.builder().transactionId(txHash).index(txIndex).build()
                }.onFailure { println("[TxBuilder] Failed to parse collateral UTxO: ${it.message}") }.getOrNull()
            }
            if (collateralInputs.isNotEmpty()) {
                transaction.body.collateral = collateralInputs
                println("[TxBuilder] collateral inputs set: ${collateralInputs.size}")
            }
        }
        // Fallback: wallet didn't supply explicit collateral — use the first selected TX input.
        // Any ADA-bearing UTxO is valid collateral; the fee padding covers execution costs.
        if (transaction.body.collateral.isNullOrEmpty()) {
            val firstInput = transaction.body.inputs?.firstOrNull()
            if (firstInput != null) {
                transaction.body.collateral = listOf(firstInput)
                println("[TxBuilder] collateral fallback: ${firstInput.transactionId}#${firstInput.index}")
            } else {
                println("[TxBuilder] WARNING: no collateral available — TX may fail with error 3132")
            }
        }

        // Compute scriptDataHash (TX body key 11).
        // Conway format: blake2b-256(redeemers_map || "" || languageViews({PlutusV3: costModel}))
        val costMdls = CostMdls()
        runCatching {
            val pp = backendService.epochService.getProtocolParameters().value
            CostModelUtil.getCostModelFromProtocolParams(pp, Language.PLUTUS_V3).ifPresent { costMdls.add(it) }
        }.onFailure { println("[TxBuilder] Protocol params fetch failed, using hardcoded V3 cost model: ${it.message}") }
        if (costMdls.isEmpty) costMdls.add(CostModelUtil.PlutusV3CostModel)
        val scriptDataHash = ScriptDataHashGenerator.generate(Era.Conway, listOf(redeemer), emptyList(), costMdls)
        println("[TxBuilder] scriptDataHash = ${HexUtil.encodeHexString(scriptDataHash)}")

        // Pad fee: script bytes (2135) + script data hash (34B) + redeemer (~30B) + execution units cost
        // Exec cost estimate: 1M mem * 0.0577 + 1B steps * 0.0000721 ≈ 130,000 lovelace
        val padding = BigInteger.valueOf(300_000L)
        val body = transaction.body
        body.scriptDataHash = scriptDataHash
        body.fee = body.fee.add(padding)
        body.outputs.firstOrNull { it.address == changeAddress }?.let { changeOut ->
            if (changeOut.value.coin >= padding) {
                changeOut.value.coin = changeOut.value.coin.subtract(padding)
            }
        }

        val certCount = transaction.body.certs?.size ?: 0
        println("[TxBuilder] TreasuryWithdrawal TX with guardrails script: certs=$certCount fee=${transaction.body.fee}")
        return transaction.serializeToHex()
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
    @Suppress("UNCHECKED_CAST")
    private fun buildUnsigned(tx: AbstractTx<*>, changeAddress: String): String {
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
