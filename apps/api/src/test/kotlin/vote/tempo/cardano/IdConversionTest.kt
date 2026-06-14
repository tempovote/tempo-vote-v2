package vote.tempo.cardano

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Unit tests for the bech32 / credential-hex conversions in OgmiosStateQueries.kt.
 *
 * These are the foundation of the whole canonical-DRep-ID system: canParticipate
 * (community membership), the CIP-129 → CIP-105 profile redirect, and every place
 * that compares two DRep IDs by normalising them to credential hex. A regression
 * here silently breaks authorization, so the round-trip invariants are pinned here.
 */
class IdConversionTest {

    // A real CIP-105 DRep ID observed in the field (the community-routing bug report).
    private val realDrepId = "drep182eqed5jzyh20cv6lskhf20uekww66t4t9llsg0r565zgmmhjc6"

    private val hexAlphabet = "0123456789abcdef"

    // ── drepIdToCredentialHex ───────────────────────────────────────────────

    @Test
    fun `passes through a raw hex credential unchanged`() {
        // Inputs not prefixed with "drep" are assumed to already be credential hex.
        val hex = "ab".repeat(28) // 56 hex chars
        assertEquals(hex, drepIdToCredentialHex(hex))
    }

    @Test
    fun `decodes a bech32 drep id to a 28-byte lowercase hex credential`() {
        val hex = drepIdToCredentialHex(realDrepId)
        assertEquals(56, hex.length, "credential must be 28 bytes (56 hex chars)")
        assertTrue(hex.all { it in hexAlphabet }, "must be lowercase hex, got: $hex")
    }

    // ── credentialHexToDrepIdCip105 ↔ drepIdToCredentialHex round-trips ──────

    @Test
    fun `round-trips an all-zero credential`() = assertRoundTrip("00".repeat(28))

    @Test
    fun `round-trips an all-ff credential`() = assertRoundTrip("ff".repeat(28))

    @Test
    fun `round-trips a mixed credential`() =
        assertRoundTrip("0123456789abcdef0123456789abcdef0123456789abcdef01234567")

    private fun assertRoundTrip(credHex: String) {
        val drepId = credentialHexToDrepIdCip105(credHex)
        assertNotNull(drepId, "valid 28-byte credential must encode")
        assertTrue(drepId.startsWith("drep1"), "must be a CIP-105 drep id, got: $drepId")
        assertEquals(credHex, drepIdToCredentialHex(drepId), "hex → drep1 → hex must be identity")
    }

    @Test
    fun `canonical form of a real drep id is normalization-stable`() {
        // The invariant canParticipate relies on: bech32 → hex → bech32 → hex
        // always yields the same credential hex regardless of input encoding.
        val hex = drepIdToCredentialHex(realDrepId)
        val canonical = credentialHexToDrepIdCip105(hex)
        assertNotNull(canonical)
        assertEquals(hex, drepIdToCredentialHex(canonical))
    }

    @Test
    fun `bech32 and raw-hex forms of the same DRep compare equal after normalization`() {
        val hex = drepIdToCredentialHex(realDrepId)
        // Feeding the already-hex form is a no-op, so the two encodings normalize equal —
        // this is exactly how membership compares communityDrepId vs jwt/delegated IDs.
        assertEquals(hex, drepIdToCredentialHex(hex))
    }

    @Test
    fun `credentialHexToDrepIdCip105 rejects wrong-length input`() {
        assertNull(credentialHexToDrepIdCip105("ab".repeat(27)), "27 bytes is invalid")
        assertNull(credentialHexToDrepIdCip105("ab".repeat(29)), "29 bytes is invalid")
    }

    @Test
    fun `credentialHexToDrepIdCip105 rejects non-hex input`() {
        assertNull(credentialHexToDrepIdCip105("zz".repeat(28)))
    }

    // ── Other bech32 encoders ───────────────────────────────────────────────

    @Test
    fun `txHashToGovActionId produces a gov_action bech32 id`() {
        val id = txHashToGovActionId("0".repeat(64), 0) // 32-byte tx hash
        assertTrue(id.startsWith("gov_action1"), "got: $id")
    }

    @Test
    fun `txHashToGovActionId encodes the action index`() {
        val txHash = "0".repeat(64)
        assertNotEquals(txHashToGovActionId(txHash, 0), txHashToGovActionId(txHash, 1))
    }

    @Test
    fun `poolIdHexToBech32 produces a pool bech32 id`() {
        val id = poolIdHexToBech32("ab".repeat(28))
        assertTrue(id.startsWith("pool1"), "got: $id")
    }

    // ── Stake address conversions ───────────────────────────────────────────

    @Test
    fun `stake address round-trips for mainnet`() {
        val cred = "12".repeat(28)
        val addr = credentialHexToStakeAddress(cred, Network.MAINNET)
        assertNotNull(addr)
        assertTrue(addr.startsWith("stake1"), "got: $addr")
        assertEquals(cred, stakeAddressToCredentialHex(addr))
    }

    @Test
    fun `stake address round-trips for preprod`() {
        val cred = "34".repeat(28)
        val addr = credentialHexToStakeAddress(cred, Network.PREPROD)
        assertNotNull(addr)
        assertTrue(addr.startsWith("stake_test1"), "got: $addr")
        assertEquals(cred, stakeAddressToCredentialHex(addr))
    }

    @Test
    fun `credentialHexToStakeAddress rejects wrong-length credential`() {
        assertNull(credentialHexToStakeAddress("12".repeat(27), Network.MAINNET))
    }

    @Test
    fun `stakeAddressToCredentialHex returns null for malformed input`() {
        assertNull(stakeAddressToCredentialHex("not-a-stake-address"))
    }
}
