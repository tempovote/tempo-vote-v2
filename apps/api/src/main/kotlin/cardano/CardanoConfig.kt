package vote.tempo.cardano

import com.bloxbean.cardano.client.api.model.ProtocolParams
import com.bloxbean.cardano.client.api.model.Result
import com.bloxbean.cardano.client.backend.KupmiosBackendService
import com.bloxbean.cardano.client.backend.api.BackendService
import com.bloxbean.cardano.client.backend.api.EpochService
import java.math.BigInteger

enum class Network { PREPROD, MAINNET }

fun Network.fromNetworkId(networkId: Int): Network =
    if (networkId == 1) Network.MAINNET else Network.PREPROD

/**
 * Creates a KupmiosBackendService for the given network.
 * KupmiosBackendService combines:
 *   - Ogmios (WebSocket): protocol params, tx submission, tx evaluation
 *   - Kupo (HTTP REST): UTxO queries
 *
 * This single BackendService is sufficient for QuickTxBuilder.
 */
fun getBackendService(network: Network): BackendService {
    val ogmiosUrl = when (network) {
        Network.PREPROD -> System.getenv("OGMIOS_PREPROD_URL") ?: error("OGMIOS_PREPROD_URL not set")
        Network.MAINNET -> System.getenv("OGMIOS_MAINNET_URL") ?: error("OGMIOS_MAINNET_URL not set")
    }
    val kupoUrl = when (network) {
        Network.PREPROD -> System.getenv("KUPO_PREPROD_URL") ?: error("KUPO_PREPROD_URL not set")
        Network.MAINNET -> System.getenv("KUPO_MAINNET_URL") ?: error("KUPO_MAINNET_URL not set")
    }
    // KupmiosBackendService uses OkHttp which requires http(s)://.
    // OGMIOS_*_URL may be ws(s):// — convert so OkHttp accepts it.
    val ogmiosHttpUrl = ogmiosUrl
        .replaceFirst("wss://", "https://")
        .replaceFirst("ws://", "http://")
    return ConwayPatchBackendService(KupmiosBackendService(ogmiosHttpUrl, kupoUrl))
}

fun networkFromString(s: String): Network = when (s.lowercase()) {
    "mainnet" -> Network.MAINNET
    else -> Network.PREPROD
}

// cardano-client-lib 0.7.0-beta1 does not map Ogmios "delegateRepresentativeDeposit"
// to ProtocolParams.drepDeposit, leaving it null and causing NPE in QuickTxBuilder.
// These wrappers patch the field to the correct on-chain value (500 ADA) when missing.
private class ConwayParamsPatchEpochService(
    private val delegate: EpochService,
) : EpochService by delegate {

    override fun getProtocolParameters(): Result<ProtocolParams> =
        delegate.getProtocolParameters().also { patchDrepDeposit(it) }

    override fun getProtocolParameters(epoch: Int?): Result<ProtocolParams> =
        delegate.getProtocolParameters(epoch).also { patchDrepDeposit(it) }

    private fun patchDrepDeposit(result: Result<ProtocolParams>) {
        if (result.isSuccessful) {
            if (result.value?.drepDeposit == null)
                result.value.drepDeposit = BigInteger.valueOf(500_000_000L)
            if (result.value?.govActionDeposit == null)
                result.value.govActionDeposit = BigInteger.valueOf(100_000_000_000L)
        }
    }
}

private class ConwayPatchBackendService(
    private val delegate: BackendService,
) : BackendService by delegate {
    private val patchedEpoch = ConwayParamsPatchEpochService(delegate.getEpochService())
    override fun getEpochService(): EpochService = patchedEpoch
}
