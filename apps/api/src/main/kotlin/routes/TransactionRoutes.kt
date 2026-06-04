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
)

@Serializable
data class BuildTxResponse(val unsignedTxCbor: String)

@Serializable
data class SubmitTxRequest(val signedTx: String, val network: String)

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
                val result = backendService.transactionService.submitTransaction(
                    req.signedTx.hexToByteArray()
                )
                result.value ?: error("Submit returned null txHash")
            }.fold(
                onSuccess = { txHash -> call.respond(SubmitTxResponse(txHash)) },
                onFailure = { e -> call.respond(HttpStatusCode.BadRequest, ErrorResponse(e.message ?: "Submit failed")) }
            )
        }
    }
}

private fun String.hexToByteArray(): ByteArray {
    check(length % 2 == 0) { "Hex string must have even length" }
    return ByteArray(length / 2) { i -> Integer.parseInt(substring(i * 2, i * 2 + 2), 16).toByte() }
}
