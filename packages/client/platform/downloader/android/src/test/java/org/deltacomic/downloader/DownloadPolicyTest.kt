package org.deltacomic.downloader

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadPolicyTest {
    @Test
    fun selectsUidtOnlyOnApi34AndLater() {
        assertEquals(BackgroundBackend.WORK_MANAGER, backendForApi(26))
        assertEquals(BackgroundBackend.WORK_MANAGER, backendForApi(33))
        assertEquals(BackgroundBackend.UIDT, backendForApi(34))
        assertEquals(BackgroundBackend.UIDT, backendForApi(36))
        assertEquals(BackgroundBackend.WORK_MANAGER, backendForApi(Int.MIN_VALUE))
        assertEquals(BackgroundBackend.UIDT, backendForApi(Int.MAX_VALUE))
    }

    @Test
    fun serializesThePermissionResultForTheRustMobileBridge() {
        val mapper = ObjectMapper()
        assertEquals(
            """{"notificationPermission":"granted"}""",
            mapper.writeValueAsString(ScheduleResult(NotificationPermissionStatus.GRANTED.wireValue))
        )
        assertEquals(
            """{"notificationPermission":"denied"}""",
            mapper.writeValueAsString(ScheduleResult(NotificationPermissionStatus.DENIED.wireValue))
        )
        assertEquals(
            """{"notificationPermission":"notRequired"}""",
            mapper.writeValueAsString(
                ScheduleResult(NotificationPermissionStatus.NOT_REQUIRED.wireValue)
            )
        )
    }

    @Test
    fun platformIdsAreStablePositiveAndNeverZero() {
        assertEquals(stablePlatformId("task-1"), stablePlatformId("task-1"))
        assertEquals(1, stablePlatformId(""))
        assertEquals(1, stablePlatformId("", Int.MIN_VALUE))
        assertTrue(stablePlatformId("task-1") > 0)
        assertTrue(stablePlatformId("task-1", 0x13579bdf) > 0)
        assertNotEquals(stablePlatformId("task-1"), stablePlatformId("task-1", 0x13579bdf))
        assertNotEquals(
            stablePlatformId("task-1", 0x13579bdf),
            stablePlatformId("task-1", 0x2468ace)
        )
    }

    @Test
    fun validatesVersionedAbsoluteHeadlessEngineConfiguration() {
        assertTrue(
            validHeadlessEngineConfig(
                HeadlessEngineConfig(
                    ENGINE_CONFIG_VERSION,
                    "/data/user/0/org.delta/files/downloader.sqlite",
                    "/data/user/0/org.delta/files/downloads"
                )
            )
        )
        assertEquals(
            false,
            validHeadlessEngineConfig(
                HeadlessEngineConfig(
                    ENGINE_CONFIG_VERSION + 1,
                    "/data/user/0/org.delta/files/downloader.sqlite",
                    "/data/user/0/org.delta/files/downloads"
                )
            )
        )
        assertEquals(
            false,
            validHeadlessEngineConfig(
                HeadlessEngineConfig(ENGINE_CONFIG_VERSION, "relative.sqlite", "/downloads")
            )
        )
    }

    @Test
    fun acceptsOnlyRelativeSafExportPaths() {
        assertTrue(validSafRelativePath("Comic/001.cbz"))
        assertEquals(false, validSafRelativePath("/Comic/001.cbz"))
        assertEquals(false, validSafRelativePath("../outside"))
        assertEquals(false, validSafRelativePath("Comic\\001.cbz"))
        assertEquals(false, validSafRelativePath("Comic//001.cbz"))
        assertEquals(false, validSafRelativePath("Comic/./001.cbz"))
    }

    @Test
    fun bindsExportedDocumentsToThePersistedTree() {
        val tree = "content://provider/tree/primary%3ADownloads"
        assertTrue(
            validSafDocumentBinding(
                tree,
                "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Fcomic.cbz"
            )
        )
        assertEquals(false, validSafDocumentBinding(tree, tree))
        assertEquals(
            false,
            validSafDocumentBinding(
                tree,
                "content://provider/tree/primary%3AOther/document/primary%3AOther%2Fcomic.cbz"
            )
        )
        assertEquals(
            false,
            validSafDocumentBinding(
                tree,
                "content://other/tree/primary%3ADownloads/document/primary%3ADownloads%2Fcomic.cbz"
            )
        )
    }
}
