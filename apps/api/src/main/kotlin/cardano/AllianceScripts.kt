package vote.tempo.cardano

import com.bloxbean.cardano.client.address.AddressProvider
import com.bloxbean.cardano.client.address.Credential
import com.bloxbean.cardano.client.common.model.Networks
import com.bloxbean.cardano.client.plutus.spec.PlutusV3Script
import com.bloxbean.cardano.client.util.HexUtil
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Alliance treasury smart contract scripts.
 *
 * Source: contracts/alliance_treasury/validators/
 *   treasury.ak          — spends treasury UTxOs; checks finalization UTXO + timelock + recipient
 *   proposal_registry.ak — graveyard for Finalization TX outputs (always fails spend)
 *
 * Both scripts compiled to Plutus V3 with Aiken v1.1.22.
 * Script CBOR loaded from /plutus-alliance.json on the classpath.
 */
object AllianceScripts {

    private val json = Json { ignoreUnknownKeys = true }

    private val blueprint: JsonArray by lazy {
        val raw = AllianceScripts::class.java.getResourceAsStream("/plutus-alliance.json")
            ?.bufferedReader()?.readText()
            ?: error("plutus-alliance.json not found on classpath")
        json.parseToJsonElement(raw).jsonObject["validators"]!!.jsonArray
    }

    private fun compiledCode(title: String): String =
        blueprint.first { it.jsonObject["title"]?.jsonPrimitive?.content == title }
            .jsonObject["compiledCode"]!!.jsonPrimitive.content

    private fun scriptHash(title: String): String =
        blueprint.first { it.jsonObject["title"]?.jsonPrimitive?.content == title }
            .jsonObject["hash"]!!.jsonPrimitive.content

    val TREASURY_SCRIPT_CBOR: String by lazy { compiledCode("treasury.treasury.spend") }
    val TREASURY_SCRIPT_HASH: String by lazy { scriptHash("treasury.treasury.spend") }

    val PROPOSAL_REGISTRY_SCRIPT_CBOR: String by lazy { compiledCode("proposal_registry.proposal_registry.spend") }
    val PROPOSAL_REGISTRY_SCRIPT_HASH: String by lazy { scriptHash("proposal_registry.proposal_registry.spend") }

    // V1 treasury script (deployed before the change-back security fix).
    // Kept so existing UTxOs at the V1 address can still be spent and migrated
    // to the current treasury address via normal withdrawal TXs.
    const val TREASURY_V1_SCRIPT_HASH = "ac8a0b8790483c05502dd3aa0d9896755a47920de8978dfd39c025e3"
    private val TREASURY_V1_SCRIPT_CBOR: String by lazy {
        val raw = AllianceScripts::class.java.getResourceAsStream("/plutus-alliance-v1.json")
            ?.bufferedReader()?.readText()
            ?: error("plutus-alliance-v1.json not found on classpath")
        json.parseToJsonElement(raw).jsonObject["validators"]!!.jsonArray
            .first { it.jsonObject["title"]?.jsonPrimitive?.content == "treasury.treasury.spend" }
            .jsonObject["compiledCode"]!!.jsonPrimitive.content
    }

    /**
     * Derive the Alliance treasury bech32 address for the given network.
     * All alliances share this address; UTxOs are identified by their inline datum alliance_id.
     */
    fun treasuryAddress(network: Network): String {
        val scriptHashBytes = HexUtil.decodeHexString(TREASURY_SCRIPT_HASH)
        val cardanoNetwork = if (network == Network.MAINNET) Networks.mainnet() else Networks.testnet()
        return AddressProvider.getEntAddress(Credential.fromScript(scriptHashBytes), cardanoNetwork).toBech32()
    }

    /** V1 treasury address — used to detect legacy UTxOs that need migration. */
    fun treasuryV1Address(network: Network): String {
        val scriptHashBytes = HexUtil.decodeHexString(TREASURY_V1_SCRIPT_HASH)
        val cardanoNetwork = if (network == Network.MAINNET) Networks.mainnet() else Networks.testnet()
        return AddressProvider.getEntAddress(Credential.fromScript(scriptHashBytes), cardanoNetwork).toBech32()
    }

    /**
     * Derive the Proposal Registry bech32 address.
     * Finalization TX outputs (ProposalResult inline datums) live here permanently.
     */
    fun proposalRegistryAddress(network: Network): String {
        val scriptHashBytes = HexUtil.decodeHexString(PROPOSAL_REGISTRY_SCRIPT_HASH)
        val cardanoNetwork = if (network == Network.MAINNET) Networks.mainnet() else Networks.testnet()
        return AddressProvider.getEntAddress(Credential.fromScript(scriptHashBytes), cardanoNetwork).toBech32()
    }

    fun buildPlutusScript(compiledCodeHex: String): PlutusV3Script {
        val len = compiledCodeHex.length / 2
        val lenHex = "%04x".format(len)
        return PlutusV3Script.builder().cborHex("59$lenHex$compiledCodeHex").build()
    }

    fun treasuryV1Script(): PlutusV3Script = buildPlutusScript(TREASURY_V1_SCRIPT_CBOR)
    fun treasuryScript(): PlutusV3Script = buildPlutusScript(TREASURY_SCRIPT_CBOR)
    fun proposalRegistryScript(): PlutusV3Script = buildPlutusScript(PROPOSAL_REGISTRY_SCRIPT_CBOR)

    /** UUID string (with dashes) → 16-byte ByteArray for Plutus datum/redeemer. */
    fun uuidToBytes(uuid: java.util.UUID): ByteArray =
        HexUtil.decodeHexString(uuid.toString().replace("-", ""))
}
