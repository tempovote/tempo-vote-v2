package vote.tempo.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import vote.tempo.cardano.Network
import vote.tempo.cardano.TxBuilder
import vote.tempo.cardano.getBackendService
import vote.tempo.cardano.networkFromString
import com.bloxbean.cardano.client.backend.api.BackendService
import com.bloxbean.cardano.client.transaction.spec.Transaction
import com.bloxbean.cardano.client.transaction.spec.TransactionWitnessSet
import com.bloxbean.cardano.client.util.HexUtil
import co.nstant.`in`.cbor.CborDecoder
import co.nstant.`in`.cbor.model.Map as CborMap
import java.io.ByteArrayInputStream

@Serializable
data class BuildTxRequest(
    val txType: String,           // DREP_REGISTER | DREP_UPDATE | DREP_RETIRE | VOTE | DELEGATE
    val network: String,          // "preprod" | "mainnet"
    val utxos: List<String>,      // CBOR hex UTxOs from wallet.getUtxos()
    val changeAddress: String,
    val rewardAddress: String,
    // DRep operations
    val drepId: String? = null,
    val anchorUrl: String? = null,
    val anchorDataHash: String? = null,
    // Vote
    val govActionTxHash: String? = null,
    val govActionIndex: Int? = null,
    val voteKind: String? = null,   // YES | NO | ABSTAIN
    val rationaleUrl: String? = null,
    val rationaleHash: String? = null,
    // Delegation
    val delegationType: String? = null,  // drep | abstain | no_confidence
    val targetDrepId: String? = null,
    // DREP_REGISTER: include a self-delegation cert in the same TX (atomic)
    val selfDelegate: Boolean = false,
    // Governance proposals — previous GA of same type (on-chain chaining, null = first of type)
    val prevGovActionTxHash: String? = null,
    val prevGovActionIdx: Int? = null,
    // PROPOSE_HARD_FORK: target protocol version
    val protocolVersionMajor: Int? = null,
    val protocolVersionMinor: Int? = null,
    // PROPOSE_NEW_CONSTITUTION: constitution document anchor (separate from proposal anchor)
    val constitutionAnchorUrl: String? = null,
    val constitutionAnchorHash: String? = null,
    val constitutionScriptHash: String? = null,
)

@Serializable
data class BuildTxResponse(val unsignedTxCbor: String)

@Serializable
data class SubmitTxRequest(
    val network: String,
    val signedTx: String? = null,            // legacy: full signed TX CBOR
    val unsignedTxCbor: String? = null,      // preferred: unsigned TX from /tx/build
    val witnessSetCbor: String? = null,      // preferred: witness set from wallet.signTx
)

@Serializable
data class SubmitTxResponse(val txHash: String)

@Serializable
data class ErrorResponse(val message: String)

fun Route.transactionRoutes() {
    route("/tx") {

        /**
         * POST /tx/build
         * Accepts wallet UTxOs + params, returns unsigned transaction CBOR.
         */
        post("/build") {
            val req = call.receive<BuildTxRequest>()
            val network = networkFromString(req.network)
            val builder = TxBuilder(network)

            runCatching {
                when (req.txType.uppercase()) {
                    "DREP_REGISTER" -> builder.buildDRepRegister(
                        changeAddress = req.changeAddress,
                        rewardAddress = req.rewardAddress,
                        drepId = req.drepId ?: error("drepId required"),
                        anchorUrl = req.anchorUrl ?: error("anchorUrl required"),
                        anchorDataHash = req.anchorDataHash ?: error("anchorDataHash required"),
                        selfDelegate = req.selfDelegate,
                    )
                    "DREP_UPDATE" -> builder.buildDRepUpdate(
                        changeAddress = req.changeAddress,
                        drepId = req.drepId ?: error("drepId required"),
                        anchorUrl = req.anchorUrl,
                        anchorDataHash = req.anchorDataHash,
                    )
                    "DREP_RETIRE" -> builder.buildDRepRetire(
                        changeAddress = req.changeAddress,
                        drepId = req.drepId ?: error("drepId required"),
                    )
                    "VOTE" -> builder.buildVote(
                        changeAddress = req.changeAddress,
                        drepId = req.drepId ?: error("drepId required"),
                        govActionTxHash = req.govActionTxHash ?: error("govActionTxHash required"),
                        govActionIndex = req.govActionIndex ?: 0,
                        voteKind = req.voteKind ?: "ABSTAIN",
                        rationaleUrl = req.rationaleUrl,
                        rationaleHash = req.rationaleHash,
                    )
                    "DELEGATE" -> builder.buildDelegation(
                        changeAddress = req.changeAddress,
                        rewardAddress = req.rewardAddress,
                        delegationType = req.delegationType ?: "drep",
                        targetDrepId = req.targetDrepId,
                    )
                    "PROPOSE_INFO_ACTION" -> builder.buildInfoAction(
                        changeAddress = req.changeAddress,
                        rewardAddress = req.rewardAddress,
                        anchorUrl = req.anchorUrl ?: error("anchorUrl required"),
                        anchorDataHash = req.anchorDataHash ?: error("anchorDataHash required"),
                    )
                    "PROPOSE_NO_CONFIDENCE" -> builder.buildNoConfidence(
                        changeAddress = req.changeAddress,
                        rewardAddress = req.rewardAddress,
                        anchorUrl = req.anchorUrl ?: error("anchorUrl required"),
                        anchorDataHash = req.anchorDataHash ?: error("anchorDataHash required"),
                        prevGovActionTxHash = req.prevGovActionTxHash,
                        prevGovActionIdx = req.prevGovActionIdx,
                    )
                    "PROPOSE_HARD_FORK" -> builder.buildHardFork(
                        changeAddress = req.changeAddress,
                        rewardAddress = req.rewardAddress,
                        anchorUrl = req.anchorUrl ?: error("anchorUrl required"),
                        anchorDataHash = req.anchorDataHash ?: error("anchorDataHash required"),
                        protocolVersionMajor = req.protocolVersionMajor ?: error("protocolVersionMajor required"),
                        protocolVersionMinor = req.protocolVersionMinor ?: 0,
                        prevGovActionTxHash = req.prevGovActionTxHash,
                        prevGovActionIdx = req.prevGovActionIdx,
                    )
                    "PROPOSE_NEW_CONSTITUTION" -> builder.buildNewConstitution(
                        changeAddress = req.changeAddress,
                        rewardAddress = req.rewardAddress,
                        anchorUrl = req.anchorUrl ?: error("anchorUrl required"),
                        anchorDataHash = req.anchorDataHash ?: error("anchorDataHash required"),
                        constitutionAnchorUrl = req.constitutionAnchorUrl ?: error("constitutionAnchorUrl required"),
                        constitutionAnchorHash = req.constitutionAnchorHash ?: error("constitutionAnchorHash required"),
                        constitutionScriptHash = req.constitutionScriptHash,
                        prevGovActionTxHash = req.prevGovActionTxHash,
                        prevGovActionIdx = req.prevGovActionIdx,
                    )
                    "ACTIVATE_COMMUNITY" -> {
                        val envKey = if (req.network == "mainnet") "PLATFORM_FEE_ADDRESS_MAINNET" else "PLATFORM_FEE_ADDRESS_PREPROD"
                        val platformFeeAddress = System.getenv(envKey)
                            ?: error("$envKey env var not configured")
                        builder.buildPayment(
                            changeAddress = req.changeAddress,
                            toAddress = platformFeeAddress,
                            lovelace = 2_000_000L,
                        )
                    }
                    else -> error("Unknown txType: ${req.txType}")
                }
            }.fold(
                onSuccess = { cbor -> call.respond(BuildTxResponse(cbor)) },
                onFailure = { e -> call.respond(HttpStatusCode.BadRequest, ErrorResponse(e.message ?: "Build failed")) }
            )
        }

        /**
         * POST /tx/submit
         * Accepts signed transaction CBOR, submits via Ogmios, returns txHash.
         */
        post("/submit") {
            val req = call.receive<SubmitTxRequest>()
            val network = networkFromString(req.network)
            val backendService: BackendService = getBackendService(network)

            runCatching {
                val txBytes = when {
                    req.unsignedTxCbor != null && req.witnessSetCbor != null -> {
                        // Assemble full signed TX: merge body from unsigned TX with wallet witness set
                        val unsignedTx = Transaction.deserialize(HexUtil.decodeHexString(req.unsignedTxCbor))
                        val witnessBytes = HexUtil.decodeHexString(req.witnessSetCbor)
                        val witnessMap = CborDecoder(ByteArrayInputStream(witnessBytes)).decode().first() as CborMap
                        val witnessSet = TransactionWitnessSet.deserialize(witnessMap)
                        unsignedTx.witnessSet = witnessSet
                        unsignedTx.serialize()
                    }
                    req.signedTx != null -> req.signedTx.hexToByteArray()
                    else -> error("Provide either signedTx or both unsignedTxCbor + witnessSetCbor")
                }

                val result = backendService.transactionService.submitTransaction(txBytes)
                if (!result.isSuccessful) {
                    error(result.response ?: "Ogmios submit failed (no response body)")
                }
                result.value ?: error("Ogmios submit succeeded but txHash is null (response: ${result.response})")
            }.fold(
                onSuccess = { txHash -> call.respond(SubmitTxResponse(txHash)) },
                onFailure = { e ->
                    call.respond(HttpStatusCode.BadRequest, ErrorResponse(e.message ?: "Submit failed"))
                }
            )
        }
    }
}

private fun String.hexToByteArray(): ByteArray {
    check(length % 2 == 0) { "Hex string must have even length" }
    return ByteArray(length / 2) { i -> Integer.parseInt(substring(i * 2, i * 2 + 2), 16).toByte() }
}
