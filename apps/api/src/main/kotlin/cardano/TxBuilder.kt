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
import com.bloxbean.cardano.client.api.model.Utxo
import com.bloxbean.cardano.client.quicktx.AbstractTx
import com.bloxbean.cardano.client.quicktx.QuickTxBuilder
import com.bloxbean.cardano.client.quicktx.ScriptTx
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
import com.bloxbean.cardano.client.transaction.spec.governance.actions.ParameterChangeAction
import com.bloxbean.cardano.client.transaction.spec.governance.actions.UpdateCommittee
import com.bloxbean.cardano.client.transaction.spec.ProtocolParamUpdate
import com.bloxbean.cardano.client.transaction.spec.governance.DRepVotingThresholds
import com.bloxbean.cardano.client.transaction.spec.governance.PoolVotingThresholds
import com.bloxbean.cardano.client.spec.Rational
import vote.tempo.routes.ProtocolParamUpdateItem
import vote.tempo.routes.VoteItem
import java.util.UUID
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
     * Build an unsigned transaction containing multiple votes in a single TX body.
     * All votes are cast by the same DRep; each may carry its own optional rationale anchor.
     */
    fun buildMultiVote(
        changeAddress: String,
        drepId: String,
        votes: List<VoteItem>,
    ): String {
        val voter = Voter(VoterType.DREP_KEY_HASH, drepIdToCredential(drepId))
        var tx = Tx()
        for (v in votes) {
            val govActionId = GovActionId(v.govActionTxHash, v.govActionIndex)
            val vote = when (v.voteKind.uppercase()) {
                "YES"  -> Vote.YES
                "NO"   -> Vote.NO
                else   -> Vote.ABSTAIN
            }
            tx = if (v.rationaleUrl != null && v.rationaleHash != null) {
                val anchor = Anchor(v.rationaleUrl, HexUtil.decodeHexString(v.rationaleHash))
                tx.createVote(voter, govActionId, vote, anchor)
            } else {
                tx.createVote(voter, govActionId, vote)
            }
        }
        return buildUnsigned(tx.from(changeAddress), changeAddress)
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
    suspend fun buildNewConstitution(
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
        // A constitution must reference the active guardrails script. Default to the current
        // on-chain hash when the caller leaves it blank (mainnet: fa24fb30…).
        val scriptHash = constitutionScriptHash?.takeIf { it.isNotBlank() }
            ?: OgmiosStateQueries(network).getConstitutionGuardrailsHash()?.joinToString("") { "%02x".format(it) }
        val constitution = Constitution.builder()
            .anchor(constitutionAnchor)
            .scripthash(scriptHash)
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

    /**
     * Build an unsigned Protocol Parameter Change governance proposal.
     * Like TreasuryWithdrawal, this requires the constitution guardrails script
     * (Plutus V3, tag 5 / Proposing redeemer) to be executed at submission time.
     *
     * Rate fields (expansionRate, treasuryGrowthRate, poolPledgeInfluence) are passed
     * as parts-per-million integers: 0.003 → 3000 → UnitInterval(3000, 1_000_000).
     *
     * Only the fields present in `paramUpdate` are included in the on-chain update.
     * The ledger applies only the supplied subset — other params are unchanged.
     */
    suspend fun buildProtocolParamChange(
        changeAddress: String,
        rewardAddress: String,
        anchorUrl: String,
        anchorDataHash: String,
        paramUpdate: ProtocolParamUpdateItem,
        collateral: List<String> = emptyList(),
        prevGovActionTxHash: String? = null,
        prevGovActionIdx: Int? = null,
    ): String {
        val anchor = Anchor(anchorUrl, HexUtil.decodeHexString(anchorDataHash))
        val ogmios = OgmiosStateQueries(network)
        val guardrailsHash = ogmios.getConstitutionGuardrailsHash()

        // ParameterChange must chain to the last enacted pparam update (CIP-1694, error 3159).
        // Honor an explicit prev from the caller; otherwise auto-resolve from on-chain state.
        val prevId: GovActionId? = if (prevGovActionTxHash != null && prevGovActionIdx != null) {
            GovActionId(prevGovActionTxHash, prevGovActionIdx)
        } else {
            ogmios.getLastEnactedGovActionId("protocolParametersUpdate")?.let { (tx, ix) ->
                println("[TxBuilder] ParameterChange auto-resolved prevGovActionId = $tx#$ix")
                GovActionId(tx, ix)
            }
        }

        val ppUpdate = ProtocolParamUpdate.builder().apply {
            paramUpdate.minFeeA?.let { minFeeA(BigInteger.valueOf(it)) }
            paramUpdate.minFeeB?.let { minFeeB(BigInteger.valueOf(it)) }
            paramUpdate.maxTxSize?.let { maxTxSize(it) }
            paramUpdate.maxBlockSize?.let { maxBlockSize(it) }
            paramUpdate.maxBlockHeaderSize?.let { maxBlockHeaderSize(it) }
            paramUpdate.keyDeposit?.let { keyDeposit(BigInteger.valueOf(it)) }
            paramUpdate.poolDeposit?.let { poolDeposit(BigInteger.valueOf(it)) }
            paramUpdate.nOpt?.let { nOpt(it) }
            paramUpdate.maxEpoch?.let { maxEpoch(it) }
            paramUpdate.minPoolCost?.let { minPoolCost(BigInteger.valueOf(it)) }
            paramUpdate.adaPerUtxoByte?.let { adaPerUtxoByte(BigInteger.valueOf(it)) }
            paramUpdate.maxValSize?.let { maxValSize(it) }
            paramUpdate.collateralPercent?.let { collateralPercent(it) }
            paramUpdate.maxCollateralInputs?.let { maxCollateralInputs(it) }
            paramUpdate.poolPledgeInfluencePerMillion?.let {
                poolPledgeInfluence(Rational(BigInteger.valueOf(it), BigInteger.valueOf(1_000_000L)))
            }
            paramUpdate.expansionRatePerMillion?.let {
                expansionRate(UnitInterval(BigInteger.valueOf(it), BigInteger.valueOf(1_000_000L)))
            }
            paramUpdate.treasuryGrowthRatePerMillion?.let {
                treasuryGrowthRate(UnitInterval(BigInteger.valueOf(it), BigInteger.valueOf(1_000_000L)))
            }
            // Conway governance group
            val pv = paramUpdate
            if (pv.poolVtMotionNoConfidencePerMillion != null &&
                pv.poolVtCommitteeNormalPerMillion != null &&
                pv.poolVtCommitteeNoConfidencePerMillion != null &&
                pv.poolVtHardForkInitiationPerMillion != null &&
                pv.poolVtSecurityRelevantParamPerMillion != null
            ) {
                poolVotingThresholds(PoolVotingThresholds.builder()
                    .motionNoConfidence(ui(pv.poolVtMotionNoConfidencePerMillion))
                    .committeeNormal(ui(pv.poolVtCommitteeNormalPerMillion))
                    .committeeNoConfidence(ui(pv.poolVtCommitteeNoConfidencePerMillion))
                    .hardForkInitiation(ui(pv.poolVtHardForkInitiationPerMillion))
                    .securityRelevantParamVotingThreshold(ui(pv.poolVtSecurityRelevantParamPerMillion))
                    .build())
            }
            if (pv.drepVtMotionNoConfidencePerMillion != null &&
                pv.drepVtCommitteeNormalPerMillion != null &&
                pv.drepVtCommitteeNoConfidencePerMillion != null &&
                pv.drepVtUpdateConstitutionPerMillion != null &&
                pv.drepVtHardForkInitiationPerMillion != null &&
                pv.drepVtPpNetworkGroupPerMillion != null &&
                pv.drepVtPpEconomicGroupPerMillion != null &&
                pv.drepVtPpTechnicalGroupPerMillion != null &&
                pv.drepVtPpGovernanceGroupPerMillion != null &&
                pv.drepVtTreasuryWithdrawalPerMillion != null
            ) {
                drepVotingThresholds(DRepVotingThresholds.builder()
                    .motionNoConfidence(ui(pv.drepVtMotionNoConfidencePerMillion))
                    .committeeNormal(ui(pv.drepVtCommitteeNormalPerMillion))
                    .committeeNoConfidence(ui(pv.drepVtCommitteeNoConfidencePerMillion))
                    .updateConstitution(ui(pv.drepVtUpdateConstitutionPerMillion))
                    .hardForkInitiation(ui(pv.drepVtHardForkInitiationPerMillion))
                    .ppNetworkGroup(ui(pv.drepVtPpNetworkGroupPerMillion))
                    .ppEconomicGroup(ui(pv.drepVtPpEconomicGroupPerMillion))
                    .ppTechnicalGroup(ui(pv.drepVtPpTechnicalGroupPerMillion))
                    .ppGovernanceGroup(ui(pv.drepVtPpGovernanceGroupPerMillion))
                    .treasuryWithdrawal(ui(pv.drepVtTreasuryWithdrawalPerMillion))
                    .build())
            }
            pv.committeeMinSize?.let { committeeMinSize(it) }
            pv.committeeMaxTermLength?.let { committeeMaxTermLength(it) }
            pv.govActionLifetime?.let { govActionLifetime(it) }
            pv.govActionDeposit?.let { govActionDeposit(BigInteger.valueOf(it)) }
            pv.drepDeposit?.let { drepDeposit(BigInteger.valueOf(it)) }
            pv.drepActivity?.let { drepActivity(it) }
            pv.minFeeRefScriptCostPerBytePerMillion?.let {
                minFeeRefScriptCostPerByte(Rational(BigInteger.valueOf(it), BigInteger.valueOf(1_000_000L)))
            }
        }.build()

        val action = ParameterChangeAction.builder()
            .prevGovActionId(prevId)
            .protocolParamUpdate(ppUpdate)
            .policyHash(guardrailsHash)
            .build()

        val tx = Tx().createProposal(action, rewardAddress, anchor).from(changeAddress)
        println("[TxBuilder] ProtocolParamChange: guardrailsHash=${guardrailsHash?.let { HexUtil.encodeHexString(it) }}")

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
    // Alliance treasury functions
    // -------------------------------------------------------------------------

    /**
     * Build an unsigned ALLIANCE_TREASURY_CONTRIBUTE TX.
     * Pays ADA to the shared treasury script address with an inline TreasuryDatum
     * so the treasury validator can identify which alliance owns the UTXO.
     */
    fun buildAllianceTreasuryContribute(
        changeAddress: String,
        allianceId: UUID,
        amountLovelace: Long,
    ): String {
        val datum = FinalizationTxSubmitter.buildTreasuryDatum(allianceId)
        val treasuryAddr = AllianceScripts.treasuryAddress(network)
        val tx = Tx()
            .payToContract(treasuryAddr, Amount.lovelace(BigInteger.valueOf(amountLovelace)), datum)
            .from(changeAddress)
        return buildUnsigned(tx, changeAddress)
    }

    /**
     * Build an unsigned ALLIANCE_WITHDRAW TX.
     * Spends a treasury UTXO using the treasury validator.
     * Requires:
     *  - treasuryUtxo{TxHash,Index,Lovelace}: the specific UTXO to spend
     *  - finalization{TxHash,TxIndex}: reference input with ProposalResult datum
     *  - executableAtMs: POSIX ms from the finalization datum (for validity range lower bound)
     *  - collateral: wallet ADA-only UTxO forfeited if script fails
     */
    suspend fun buildAllianceWithdraw(
        changeAddress: String,
        collateral: List<String>,
        allianceId: UUID,
        proposalId: UUID,
        treasuryUtxoTxHash: String,
        treasuryUtxoIndex: Int,
        treasuryUtxoLovelace: Long,
        finalizationTxHash: String,
        finalizationTxIndex: Int,
        recipientAddress: String,
        amountLovelace: Long,
        executableAtMs: Long,
    ): String {
        val treasuryScript = AllianceScripts.treasuryScript()
        val treasuryAddr   = AllianceScripts.treasuryAddress(network)
        val datum          = FinalizationTxSubmitter.buildTreasuryDatum(allianceId)
        val redeemer       = buildExecuteRedeemer(proposalId)

        val treasuryUtxo = Utxo.builder()
            .txHash(treasuryUtxoTxHash)
            .outputIndex(treasuryUtxoIndex)
            .address(treasuryAddr)
            .amount(listOf(Amount.lovelace(BigInteger.valueOf(treasuryUtxoLovelace))))
            .build()

        val scriptTx = ScriptTx()
            .collectFrom(treasuryUtxo, datum, redeemer)
            .readFrom(finalizationTxHash, finalizationTxIndex)
            .payToAddress(recipientAddress, Amount.lovelace(BigInteger.valueOf(amountLovelace)))
            .attachSpendingValidator(treasuryScript)

        val tx = Tx().from(changeAddress)

        val transaction = QuickTxBuilder(backendService)
            .compose(scriptTx, tx)
            .feePayer(changeAddress)
            .build()

        // Set validity range lower bound so the validator's timelock check passes.
        // In Conway era, 1 slot = 1 second; we convert executableAtMs to a slot.
        val executableAtSlot = OgmiosStateQueries(network).posixMsToSlot(executableAtMs)
        transaction.body.validityStartInterval = executableAtSlot

        // Set TTL (upper bound) = 2 hours from now to limit TX window
        val ttlSlot = OgmiosStateQueries(network).posixMsToSlot(System.currentTimeMillis() + 2 * 3600 * 1000L)
        transaction.body.ttl = ttlSlot

        // Attach collateral inputs (required for Plutus spending TX)
        val collateralInputs = collateral.mapNotNull { utxoCbor ->
            runCatching {
                val items = co.nstant.`in`.cbor.CborDecoder(java.io.ByteArrayInputStream(HexUtil.decodeHexString(utxoCbor))).decode()
                val utxoArr = items.first() as co.nstant.`in`.cbor.model.Array
                val inputArr = utxoArr.dataItems[0] as co.nstant.`in`.cbor.model.Array
                val txHash2 = HexUtil.encodeHexString((inputArr.dataItems[0] as co.nstant.`in`.cbor.model.ByteString).bytes)
                val txIndex2 = (inputArr.dataItems[1] as co.nstant.`in`.cbor.model.UnsignedInteger).value.toInt()
                TransactionInput.builder().transactionId(txHash2).index(txIndex2).build()
            }.getOrNull()
        }
        if (collateralInputs.isNotEmpty()) {
            transaction.body.collateral = collateralInputs
        } else {
            transaction.body.inputs?.firstOrNull()?.let { transaction.body.collateral = listOf(it) }
        }

        // Compute and attach scriptDataHash (TX body field 11) for the Plutus spend
        val costMdls = com.bloxbean.cardano.client.plutus.spec.CostMdls()
        runCatching {
            val pp = backendService.epochService.getProtocolParameters().value
            com.bloxbean.cardano.client.api.util.CostModelUtil.getCostModelFromProtocolParams(pp, com.bloxbean.cardano.client.plutus.spec.Language.PLUTUS_V3).ifPresent { costMdls.add(it) }
        }
        if (costMdls.isEmpty) costMdls.add(com.bloxbean.cardano.client.api.util.CostModelUtil.PlutusV3CostModel)

        // Attach spend redeemer with generous budget so QuickTxBuilder can compute fee
        fun makeSpendRedeemer(memUnits: Long, cpuUnits: Long) = Redeemer.builder()
            .tag(RedeemerTag.Spend)
            .index(0)
            .data(redeemer)
            .exUnits(ExUnits.builder()
                .mem(BigInteger.valueOf(memUnits))
                .steps(BigInteger.valueOf(cpuUnits))
                .build())
            .build()

        fun attachRedeemer(r: Redeemer) {
            val dataHash = ScriptDataHashGenerator.generate(Era.Conway, listOf(r), emptyList(), costMdls)
            transaction.body.scriptDataHash = dataHash
            val ws = transaction.witnessSet ?: TransactionWitnessSet()
            ws.redeemers = (ws.redeemers?.filter { it.tag != RedeemerTag.Spend } ?: emptyList()) + r
            transaction.witnessSet = ws
        }

        // 1. Attach with generous placeholder so the TX is well-formed for evaluateTx
        attachRedeemer(makeSpendRedeemer(2_000_000L, 2_000_000_000L))

        // 2. Try Ogmios evaluateTx to get actual execution units, then update redeemer
        val txForEval = transaction.serializeToHex()
        val realExUnits = runCatching {
            OgmiosStateQueries(network).evaluateTx(txForEval)["spend:0"]
        }.getOrNull()

        if (realExUnits != null) {
            // Add 20% headroom over evaluated ExUnits to account for minor CBOR size differences
            val mem  = (realExUnits.first  * 1.2).toLong()
            val cpu  = (realExUnits.second * 1.2).toLong()
            attachRedeemer(makeSpendRedeemer(mem, cpu))
        }

        println("[TxBuilder] AllianceWithdraw TX: " +
            "treasury=${treasuryUtxoTxHash.take(16)}#$treasuryUtxoIndex " +
            "ref=${finalizationTxHash.take(16)}#$finalizationTxIndex " +
            "executableSlot=$executableAtSlot " +
            "exUnits=${realExUnits ?: "placeholder"} fee=${transaction.body.fee}")

        return transaction.serializeToHex()
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private fun buildPrevGovActionId(txHash: String?, index: Int?): GovActionId? =
        if (txHash != null && index != null) GovActionId(txHash, index) else null

    private fun ui(perMillion: Long) = UnitInterval(BigInteger.valueOf(perMillion), BigInteger.valueOf(1_000_000L))

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
     * Parse a CC cold credential into a Credential. Accepts:
     *  • CIP-105 bech32:  cc_cold1… (key hash, 28B) / cc_cold_script1… (script, 28B)
     *  • CIP-129 bech32:  cc_cold1… with a 1-byte header (29B). Low nibble of the header
     *    is the credential type: 0x2 = key hash, 0x3 = script hash — strip it.
     *  • raw 28-byte hex key hash.
     */
    private fun parseCcCredential(credential: String): Credential {
        val trimmed = credential.trim()
        return when {
            // CIP-105 script credential uses a distinct HRP; always a 28-byte hash.
            trimmed.startsWith("cc_cold_script") ->
                Credential.fromScript(com.bloxbean.cardano.client.crypto.Bech32.decode(trimmed).data)

            // cc_cold HRP covers CIP-105 key (28B) and CIP-129 (29B: header + hash).
            trimmed.startsWith("cc_cold") -> {
                val data = com.bloxbean.cardano.client.crypto.Bech32.decode(trimmed).data
                when (data.size) {
                    28 -> Credential.fromKey(data)                         // CIP-105 key hash
                    29 -> {                                                 // CIP-129
                        val hash = data.copyOfRange(1, data.size)
                        if ((data[0].toInt() and 0x0f) == 0x03) Credential.fromScript(hash)
                        else Credential.fromKey(hash)
                    }
                    else -> error("Invalid CC cold credential: expected 28 (CIP-105) or 29 (CIP-129) bytes, got ${data.size}")
                }
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
