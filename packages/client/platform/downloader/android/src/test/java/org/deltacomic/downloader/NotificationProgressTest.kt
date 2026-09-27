package org.deltacomic.downloader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationProgressTest {
    @Test
    fun unknownOrEmptyTotalsRemainIndeterminate() {
        assertNull(notificationProgress(TaskSnapshot(totalBytes = null, downloadedBytes = 5)))
        assertNull(notificationProgress(TaskSnapshot(totalBytes = 0, downloadedBytes = 0)))
    }

    @Test
    fun knownTotalsAreScaledAndClamped() {
        assertEquals(
            NotificationProgress(1000, 250),
            notificationProgress(TaskSnapshot(totalBytes = 400, downloadedBytes = 100))
        )
        assertEquals(
            NotificationProgress(1000, 1000),
            notificationProgress(TaskSnapshot(totalBytes = 400, downloadedBytes = 500))
        )
        assertEquals(
            NotificationProgress(1000, 0),
            notificationProgress(TaskSnapshot(totalBytes = 400, downloadedBytes = -1))
        )
    }
}
