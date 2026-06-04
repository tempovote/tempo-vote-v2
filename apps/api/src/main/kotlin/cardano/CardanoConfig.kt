package vote.tempo.cardano

import com.bloxbean.cardano.client.backend.api.BackendService
import com.bloxbean.cardano.client.backend.KupmiosBackendService

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
        Network.PREPROD -> System.getenv("OGMIOS_PREPROD_URL")
            ?: error("OGMIOS_PREPROD_URL not set")
        Network.MAINNET -> System.getenv("OGMIOS_MAINNET_URL")
            ?: error("OGMIOS_MAINNET_URL not set")
    }
    val kupoUrl = when (network) {
        Network.PREPROD -> System.getenv("KUPO_PREPROD_URL")
            ?: error("KUPO_PREPROD_URL not set")
        Network.MAINNET -> System.getenv("KUPO_MAINNET_URL")
            ?: error("KUPO_MAINNET_URL not set")
    }
    return KupmiosBackendService(ogmiosUrl, kupoUrl)
}

fun networkFromString(s: String): Network = when (s.lowercase()) {
    "mainnet" -> Network.MAINNET
    else -> Network.PREPROD
}
