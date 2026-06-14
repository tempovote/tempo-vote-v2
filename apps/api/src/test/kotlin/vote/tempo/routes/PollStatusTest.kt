package vote.tempo.routes

import kotlinx.datetime.LocalDateTime
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * computeStatus derives a poll's lifecycle state from its window. The vote route
 * rejects votes unless status == "active", so the boundary behaviour (start/end
 * inclusive) is security-relevant, not cosmetic.
 */
class PollStatusTest {

    private val now = LocalDateTime(2026, 6, 14, 12, 0)

    @Test
    fun `pending when the start is in the future`() {
        assertEquals(
            "pending",
            computeStatus(
                startsAt = LocalDateTime(2026, 6, 15, 0, 0),
                endsAt = LocalDateTime(2026, 6, 20, 0, 0),
                now = now,
            ),
        )
    }

    @Test
    fun `active when now is inside the window`() {
        assertEquals(
            "active",
            computeStatus(
                startsAt = LocalDateTime(2026, 6, 10, 0, 0),
                endsAt = LocalDateTime(2026, 6, 20, 0, 0),
                now = now,
            ),
        )
    }

    @Test
    fun `closed when the end is in the past`() {
        assertEquals(
            "closed",
            computeStatus(
                startsAt = LocalDateTime(2026, 6, 1, 0, 0),
                endsAt = LocalDateTime(2026, 6, 10, 0, 0),
                now = now,
            ),
        )
    }

    @Test
    fun `active at the exact start boundary (start inclusive)`() {
        assertEquals(
            "active",
            computeStatus(startsAt = now, endsAt = LocalDateTime(2026, 6, 20, 0, 0), now = now),
        )
    }

    @Test
    fun `active at the exact end boundary (end inclusive)`() {
        assertEquals(
            "active",
            computeStatus(startsAt = LocalDateTime(2026, 6, 1, 0, 0), endsAt = now, now = now),
        )
    }
}
