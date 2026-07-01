package vote.tempo.cardano

import com.bloxbean.cardano.client.account.Account
import com.bloxbean.cardano.client.api.model.Amount
import com.bloxbean.cardano.client.common.model.Networks
import com.bloxbean.cardano.client.plutus.spec.BigIntPlutusData
import com.bloxbean.cardano.client.plutus.spec.BytesPlutusData
import com.bloxbean.cardano.client.plutus.spec.ConstrPlutusData
import com.bloxbean.cardano.client.quicktx.QuickTxBuilder
import com.bloxbean.cardano.client.quicktx.Tx
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import vote.tempo.db.AllianceProposals
import vote.tempo.db.Alliances
import java.math.BigInteger
import java.util.UUID

private val logger = KotlinLogging.logger("FinalizationTxSubmitter")

/**
 * Service wallet that auto-submits Finalization TXs for approved withdrawal proposals.
 *
 * A Finalization TX places a ProposalResult datum UTXO at the proposal_registry address.
 * This on-chain record is later used as a reference input by the treasury validator when
 * executing the actual withdrawal.
 *
 * Setup: set SERVICE_WALLET_MNEMONIC env var (15 or 24 word mnemonic), keep ~5-10 ADA
 * on the wallet's enterprise address to cover TX fees (~0.2 ADA per TX).
 */
object FinalizationTxSubmitter {

    /**
     * Build the ProposalResult inline datum for a Finalization TX.
     * Encoding matches Aiken's ProposalResult type:
     *   Constr 0 [allianceId, proposalId, result, amount, recipientPkh, executableAtMs]
     */
    fun buildProposalResultDatum(
        allianceId: UUID,
        proposalId: UUID,
        result: String,
        amountLovelace: Long,
        recipientPkh: ByteArray,
        executableAtMs: Long,
    ): ConstrPlutusData = ConstrPlutusData.of(
        0L,
        BytesPlutusData.of(AllianceScripts.uuidToBytes(allianceId)),
        BytesPlutusData.of(AllianceScripts.uuidToBytes(proposalId)),
        BytesPlutusData.of(result.toByteArray(Charsets.UTF_8)),
        BigIntPlutusData.of(amountLovelace),
        BytesPlutusData.of(recipientPkh),
        BigIntPlutusData.of(executableAtMs),
    )

    /**
     * Build the TreasuryDatum inline datum for contributions.
     * Encoding: Constr 0 [allianceId]
     */
    fun buildTreasuryDatum(allianceId: UUID): ConstrPlutusData = ConstrPlutusData.of(
        0L,
        BytesPlutusData.of(AllianceScripts.uuidToBytes(allianceId)),
    )

    /**
     * Extract 28-byte payment key hash from a bech32 Cardano address.
     * Returns null for script addresses or on any decoding failure.
     */
    fun paymentKeyHashFromAddress(bech32Address: String): ByteArray? = runCatching {
        val addr = com.bloxbean.cardano.client.address.Address(bech32Address)
        val opt = addr.getPaymentCredentialHash()
        if (opt.isPresent) opt.get() else null
    }.getOrNull()

    /**
     * Load the service wallet account from SERVICE_WALLET_MNEMONIC env var.
     * Returns null if the env var is not set.
     */
    fun getServiceAccount(network: Network): Account? {
        val raw = System.getenv("SERVICE_WALLET_MNEMONIC") ?: return null
        val mnemonic = raw.trim()
        logger.info { "SERVICE_WALLET_MNEMONIC loaded: ${mnemonic.split(" ").size} words, first=${mnemonic.split(" ").first()}, last=${mnemonic.split(" ").last()}" }
        val cardanoNetwork = if (network == Network.MAINNET) Networks.mainnet() else Networks.testnet()
        return Account(cardanoNetwork, mnemonic)
    }

    /**
     * Submit a Finalization TX for the given proposal.
     * Builds a TX that pays 2 ADA to the proposal_registry address with a ProposalResult inline datum,
     * signs it with the service wallet, and submits via Ogmios.
     *
     * @return the submitted txHash, or null on error
     */
    suspend fun submitFinalizationTx(
        proposalId: UUID,
        allianceId: UUID,
        result: String,
        amountLovelace: Long,
        recipientAddress: String,
        timelockHours: Int,
        network: Network,
    ): String? = runCatching {
        val account = getServiceAccount(network)
            ?: error("SERVICE_WALLET_MNEMONIC not configured — cannot auto-finalize")

        val recipientPkh = paymentKeyHashFromAddress(recipientAddress)
            ?: error("Cannot extract payment key hash from recipient address: $recipientAddress")

        val executableAtMs = System.currentTimeMillis() + timelockHours.toLong() * 3600L * 1000L
        val datum = buildProposalResultDatum(allianceId, proposalId, result, amountLovelace, recipientPkh, executableAtMs)

        val registryAddress = AllianceScripts.proposalRegistryAddress(network)
        val backendService = getBackendService(network)
        val serviceAddress = account.enterpriseAddress()

        val tx = Tx()
            .payToContract(registryAddress, Amount.lovelace(BigInteger.valueOf(2_000_000L)), datum)
            .from(serviceAddress)

        val builtTx = QuickTxBuilder(backendService)
            .compose(tx)
            .feePayer(serviceAddress)
            .build()

        val signedTx = account.sign(builtTx)
        val txBytes = signedTx.serialize()
        val submitResult = backendService.transactionService.submitTransaction(txBytes)

        if (!submitResult.isSuccessful) error(submitResult.response ?: "Finalization TX submit failed")
        val txHash = submitResult.value ?: error("No txHash returned")

        // Persist finalization_tx_hash + executableAt so the FE can build the withdraw TX
        withContext(Dispatchers.IO) {
            transaction {
                AllianceProposals.update({ AllianceProposals.id eq proposalId }) {
                    it[AllianceProposals.finalizationTxHash] = txHash
                    it[AllianceProposals.executableAt] = Instant.fromEpochMilliseconds(executableAtMs)
                        .toLocalDateTime(TimeZone.UTC)
                    it[AllianceProposals.status] = "approved_pending"
                }
            }
        }

        logger.info { "Finalization TX submitted: $txHash for proposal $proposalId (executableAt ${executableAtMs}ms)" }
        txHash
    }.onFailure { e ->
        val chain = generateSequence(e) { it.cause }.joinToString(" → ") { "${it.javaClass.simpleName}: ${it.message}" }
        logger.error { "Finalization TX failed for proposal $proposalId: $chain" }
        e.printStackTrace()
    }.getOrNull()

    /**
     * Find all approved withdrawal proposals without a finalization_tx_hash and submit their
     * Finalization TXs. Called from BackgroundPoller every 5 minutes.
     */
    suspend fun submitPendingFinalizations() {
        data class PendingProposal(
            val proposalId: UUID,
            val allianceId: UUID,
            val amountLovelace: Long,
            val recipientAddress: String,
            val timelockHours: Int,
            val networkStr: String,
        )

        val pending: List<PendingProposal> = withContext(Dispatchers.IO) {
            transaction {
                (AllianceProposals innerJoin Alliances)
                    .select(
                        AllianceProposals.id,
                        AllianceProposals.allianceId,
                        AllianceProposals.amountLovelace,
                        AllianceProposals.recipientAddress,
                        Alliances.timelockHours,
                        Alliances.network,
                    )
                    .where {
                        (AllianceProposals.status eq "approved") and
                        (AllianceProposals.proposalType eq "withdrawal") and
                        AllianceProposals.finalizationTxHash.isNull() and
                        AllianceProposals.amountLovelace.isNotNull() and
                        AllianceProposals.recipientAddress.isNotNull()
                    }
                    .map { row ->
                        PendingProposal(
                            proposalId       = row[AllianceProposals.id],
                            allianceId       = row[AllianceProposals.allianceId],
                            amountLovelace   = row[AllianceProposals.amountLovelace] ?: 0L,
                            recipientAddress = row[AllianceProposals.recipientAddress] ?: "",
                            timelockHours    = row[Alliances.timelockHours],
                            networkStr       = row[Alliances.network],
                        )
                    }
            }
        }

        for (p in pending) {
            val network = networkFromString(p.networkStr)
            submitFinalizationTx(
                proposalId       = p.proposalId,
                allianceId       = p.allianceId,
                result           = "approved",
                amountLovelace   = p.amountLovelace,
                recipientAddress = p.recipientAddress,
                timelockHours    = p.timelockHours,
                network          = network,
            )
        }
    }
}

/** Build the ExecuteRedeemer PlutusData: Constr 0 [proposalId] */
fun buildExecuteRedeemer(proposalId: UUID): ConstrPlutusData = ConstrPlutusData.of(
    0L,
    BytesPlutusData.of(AllianceScripts.uuidToBytes(proposalId)),
)
