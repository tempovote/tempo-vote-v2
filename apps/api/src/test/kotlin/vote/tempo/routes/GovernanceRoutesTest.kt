package vote.tempo.routes

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * isGaTitleMissRecent backs the GA title-resolution miss cache. A title fetch can fail for a
 * transient reason (slow gateway, timeout under concurrent load) rather than because the anchor
 * genuinely has no title, so a miss must expire after GA_TITLE_MISS_TTL_MS and be retried —
 * never blacklisted for the lifetime of the process.
 */
class GovernanceRoutesTest {

    @Test
    fun `key with no prior miss is not recent`() {
        assertFalse(isGaTitleMissRecent("tx#0", emptyMap(), now = 1_000_000L, ttlMs = 60_000L))
    }

    @Test
    fun `key missed just now is recent`() {
        val missCache = mapOf("tx#0" to 1_000_000L)
        assertTrue(isGaTitleMissRecent("tx#0", missCache, now = 1_000_500L, ttlMs = 60_000L))
    }

    @Test
    fun `key missed longer than TTL ago is no longer recent (eligible for retry)`() {
        val missCache = mapOf("tx#0" to 1_000_000L)
        assertFalse(isGaTitleMissRecent("tx#0", missCache, now = 1_000_000L + 60_000L, ttlMs = 60_000L))
    }

    @Test
    fun `key exactly at TTL boundary is no longer recent`() {
        val missCache = mapOf("tx#0" to 0L)
        assertFalse(isGaTitleMissRecent("tx#0", missCache, now = 60_000L, ttlMs = 60_000L))
    }
}
