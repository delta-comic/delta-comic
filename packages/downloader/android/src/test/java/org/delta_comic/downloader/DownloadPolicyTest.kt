package org.delta_comic.downloader

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
    fun mapsMeteredNetworkPolicyForBothBackends() {
        assertEquals(NetworkRequirement.CONNECTED, networkRequirement(true))
        assertEquals(NetworkRequirement.UNMETERED, networkRequirement(false))
    }

    @Test
    fun requestsNotificationPermissionOnlyForTheInitialApi33Prompt() {
        assertEquals(false, shouldRequestNotificationPermission(32, "prompt"))
        assertEquals(true, shouldRequestNotificationPermission(33, "prompt"))
        assertEquals(true, shouldRequestNotificationPermission(36, "prompt"))
        assertEquals(false, shouldRequestNotificationPermission(33, "prompt-with-rationale"))
        assertEquals(false, shouldRequestNotificationPermission(33, "denied"))
        assertEquals(false, shouldRequestNotificationPermission(33, "granted"))
        assertEquals(false, shouldRequestNotificationPermission(33, null))
    }

    @Test
    fun reportsNotificationPermissionWithoutBlockingTheTransfer() {
        assertEquals("granted", NotificationPermissionStatus.GRANTED.wireValue)
        assertEquals("denied", NotificationPermissionStatus.DENIED.wireValue)
        assertEquals("notRequired", NotificationPermissionStatus.NOT_REQUIRED.wireValue)
        assertEquals(
            NotificationPermissionStatus.NOT_REQUIRED,
            notificationPermissionStatus(32, "denied"),
        )
        assertEquals(
            NotificationPermissionStatus.GRANTED,
            notificationPermissionStatus(33, "granted"),
        )
        assertEquals(
            NotificationPermissionStatus.DENIED,
            notificationPermissionStatus(33, "denied"),
        )
        assertEquals(
            NotificationPermissionStatus.DENIED,
            notificationPermissionStatus(33, "prompt-with-rationale"),
        )
        assertEquals(
            NotificationPermissionStatus.DENIED,
            notificationPermissionStatus(36, null),
        )
    }

    @Test
    fun serializesThePermissionResultForTheRustMobileBridge() {
        val mapper = ObjectMapper()
        assertEquals(
            """{"notificationPermission":"granted"}""",
            mapper.writeValueAsString(ScheduleResult(NotificationPermissionStatus.GRANTED.wireValue)),
        )
        assertEquals(
            """{"notificationPermission":"denied"}""",
            mapper.writeValueAsString(ScheduleResult(NotificationPermissionStatus.DENIED.wireValue)),
        )
        assertEquals(
            """{"notificationPermission":"notRequired"}""",
            mapper.writeValueAsString(
                ScheduleResult(NotificationPermissionStatus.NOT_REQUIRED.wireValue)
            ),
        )
    }

    @Test
    fun mapsNativeExecutionStatesWithoutBooleanAmbiguity() {
        assertEquals(ExecutionResult.COMPLETED, executionResult(0))
        assertEquals(ExecutionResult.RETRY, executionResult(1))
        assertEquals(ExecutionResult.STOPPED, executionResult(2))
        assertEquals(ExecutionResult.RETRY, executionResult(-1))
        assertEquals(ExecutionResult.RETRY, executionResult(Int.MAX_VALUE))
    }

    @Test
    fun recognizesOnlyOwnedNotificationActions() {
        assertEquals(ControlAction.PAUSE, controlAction(ACTION_PAUSE))
        assertEquals(ControlAction.CANCEL, controlAction(ACTION_CANCEL))
        assertEquals(null, controlAction(null))
        assertEquals(null, controlAction("android.intent.action.DOWNLOAD_COMPLETE"))
        assertNotEquals(ControlAction.SYSTEM_STOP, controlAction(ACTION_PAUSE))
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
            stablePlatformId("task-1", 0x2468ace),
        )
    }

    @Test
    fun platformIdAllocationProbesCollisionsAndWraps() {
        val first = stablePlatformId("task-1")
        assertEquals(first, nextAvailablePlatformId("task-1", emptySet()))
        assertEquals(first + 1, nextAvailablePlatformId("task-1", setOf(first)))
        assertEquals(
            2,
            nextAvailablePlatformId("", setOf(Int.MAX_VALUE, 1), Int.MAX_VALUE),
        )
    }

    @Test
    fun uidtStopsRequestedByUserOrAppAreNotRescheduled() {
        assertEquals(false, shouldRescheduleUidtJob(true))
        assertEquals(true, shouldRescheduleUidtJob(false))
    }

    @Test
    fun validatesVersionedAbsoluteHeadlessEngineConfiguration() {
        assertTrue(
            validHeadlessEngineConfig(
                HeadlessEngineConfig(
                    ENGINE_CONFIG_VERSION,
                    "/data/user/0/org.delta/files/downloader.sqlite",
                    "/data/user/0/org.delta/files/downloads",
                )
            )
        )
        assertEquals(
            false,
            validHeadlessEngineConfig(
                HeadlessEngineConfig(
                    ENGINE_CONFIG_VERSION + 1,
                    "/data/user/0/org.delta/files/downloader.sqlite",
                    "/data/user/0/org.delta/files/downloads",
                )
            ),
        )
        assertEquals(
            false,
            validHeadlessEngineConfig(
                HeadlessEngineConfig(ENGINE_CONFIG_VERSION, "relative.sqlite", "/downloads")
            ),
        )
    }

    @Test
    fun resolvesTheGeneratedTauriRustClassWithoutAssumingApplicationIdSuffixes() {
        assertEquals(
            listOf("org.delta.app.Rust", "org.delta.app.debug.Rust"),
            rustBridgeClassCandidates(
                "org.delta.app.debug",
                "org.delta.app.MainActivity",
            ),
        )
        assertEquals(
            listOf("org.delta.app.Rust"),
            rustBridgeClassCandidates("org.delta.app", null),
        )
    }

    @Test
    fun derivesStableOpaqueSafDestinationIds() {
        val first = safDestinationId("content://provider/tree/primary%3AComics")
        assertEquals(first, safDestinationId("content://provider/tree/primary%3AComics"))
        assertTrue(first.matches(Regex("saf-[0-9a-f]{32}")))
        assertNotEquals(first, safDestinationId("content://provider/tree/primary%3AOther"))
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
                "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Fcomic.cbz",
            )
        )
        assertEquals(false, validSafDocumentBinding(tree, tree))
        assertEquals(
            false,
            validSafDocumentBinding(
                tree,
                "content://provider/tree/primary%3AOther/document/primary%3AOther%2Fcomic.cbz",
            ),
        )
        assertEquals(
            false,
            validSafDocumentBinding(
                tree,
                "content://other/tree/primary%3ADownloads/document/primary%3ADownloads%2Fcomic.cbz",
            ),
        )
    }
}
