package vote.tempo.cardano

import com.bloxbean.cardano.client.account.Account
import com.bloxbean.cardano.client.common.model.Networks
import kotlin.test.Test

class MnemonicAccountTest {

    @Test
    fun `Account creation and key derivation with 24-word mnemonic`() {
        val mnemonics = mapOf(
            "old (cushion)" to "cushion zebra donate feel ancient track route toilet vapor tourist dynamic call frost glad battle remove village portion science educate wall result surface surround",
            "new (finger)" to "finger noise lonely glimpse better around spoil ride february response vault ecology spare fly lava brush busy december east topple trick catch market betray",
        )

        for ((name, phrase) in mnemonics) {
            try {
                val account = Account(Networks.testnet(), phrase)
                println("$name → enterpriseAddress: ${account.enterpriseAddress()}")
                println("$name → baseAddress: ${account.baseAddress()}")
                // Try to get private key (this is what sign() uses)
                val keyPair = account.hdKeyPair()
                println("$name → hdKeyPair: ${keyPair != null}")
            } catch (e: Exception) {
                println("$name → ERROR: ${e.javaClass.simpleName}: ${e.message}")
                var cause = e.cause
                while (cause != null) {
                    println("  Caused by: ${cause.javaClass.simpleName}: ${cause.message}")
                    cause = cause.cause
                }
                e.printStackTrace()
            }
        }
    }
}
