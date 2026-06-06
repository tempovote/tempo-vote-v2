package vote.tempo.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.*
import vote.tempo.cardano.Network
import vote.tempo.cardano.networkFromString

private val walletHttpClient = HttpClient(CIO)

/**
 * GET /wallet/balance?address={bech32Address}&network={preprod|mainnet}
 * Queries Kupo for unspent UTxOs at the given address and sums lovelace.
 * Returns { address, lovelace, ada, utxoCount }.
 *
 * Kupo supports full-address queries but NOT delegation-credential-only queries
 * — so callers must pass the full bech32 payment address (wallet changeAddress).
 */
fun Route.walletRoutes() {
    route("/wallet") {
        get("/balance") {
            val address = call.request.queryParameters["address"]
                ?: return@get call.respond(
                    HttpStatusCode.BadRequest,
                    buildJsonObject { put("error", "address required") }
                )

            val network = networkFromString(call.request.queryParameters["network"] ?: "preprod")
            val kupoUrl = kupoUrl(network)

            val response = runCatching {
                withTimeout(15_000) {
                    walletHttpClient.get("$kupoUrl/matches/$address?unspent")
                }
            }.getOrElse {
                return@get call.respond(
                    HttpStatusCode.GatewayTimeout,
                    buildJsonObject { put("error", "Kupo timeout") }
                )
            }

            if (!response.status.isSuccess()) {
                return@get call.respond(
                    HttpStatusCode.BadGateway,
                    buildJsonObject { put("error", "Kupo error: ${response.status.value}") }
                )
            }

            val body = response.bodyAsText()
            val utxos = runCatching { Json.parseToJsonElement(body).jsonArray }.getOrElse { JsonArray(emptyList()) }

            val totalLovelace = utxos.sumOf { utxo ->
                utxo.jsonObject["value"]?.jsonObject?.get("coins")?.jsonPrimitive?.longOrNull ?: 0L
            }

            call.respond(buildJsonObject {
                put("address", address)
                put("lovelace", totalLovelace)
                put("ada", totalLovelace.toDouble() / 1_000_000.0)
                put("utxoCount", utxos.size)
            })
        }
    }
}

private fun kupoUrl(network: Network): String = when (network) {
    Network.MAINNET -> System.getenv("KUPO_MAINNET_URL") ?: error("KUPO_MAINNET_URL not set")
    Network.PREPROD -> System.getenv("KUPO_PREPROD_URL") ?: error("KUPO_PREPROD_URL not set")
}
