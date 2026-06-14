package vote.tempo.cardano

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * networkFromString is used everywhere a request carries a network string
 * (community routes, membership checks). It must be case-insensitive and must
 * default to PREPROD for anything that isn't exactly "mainnet" — so a malformed
 * value can never be mistaken for mainnet.
 */
class NetworkFromStringTest {

    @Test
    fun `mainnet maps to MAINNET`() {
        assertEquals(Network.MAINNET, networkFromString("mainnet"))
    }

    @Test
    fun `mainnet is case-insensitive`() {
        assertEquals(Network.MAINNET, networkFromString("MAINNET"))
        assertEquals(Network.MAINNET, networkFromString("MainNet"))
    }

    @Test
    fun `preprod maps to PREPROD`() {
        assertEquals(Network.PREPROD, networkFromString("preprod"))
    }

    @Test
    fun `unknown values default to PREPROD (never mainnet)`() {
        assertEquals(Network.PREPROD, networkFromString("testnet"))
        assertEquals(Network.PREPROD, networkFromString("foobar"))
        assertEquals(Network.PREPROD, networkFromString(""))
    }
}
