package org.delta_comic.downloader

internal enum class BackgroundBackend {
    UIDT,
    WORK_MANAGER,
}

internal enum class ExecutionResult {
    COMPLETED,
    RETRY,
    STOPPED,
}

internal enum class NetworkRequirement {
    CONNECTED,
    UNMETERED,
}

internal enum class ControlAction {
    PAUSE,
    CANCEL,
    SYSTEM_STOP,
}

internal enum class NotificationPermissionStatus(val wireValue: String) {
    GRANTED("granted"),
    DENIED("denied"),
    NOT_REQUIRED("notRequired"),
}

internal const val ACTION_PAUSE = "org.delta_comic.downloader.PAUSE"
internal const val ACTION_CANCEL = "org.delta_comic.downloader.CANCEL"
internal const val ENGINE_CONFIG_VERSION = 1

internal data class HeadlessEngineConfig(
    val version: Int,
    val databasePath: String,
    val downloadDir: String,
)

internal fun backendForApi(apiLevel: Int): BackgroundBackend =
    if (apiLevel >= 34) BackgroundBackend.UIDT else BackgroundBackend.WORK_MANAGER

internal fun networkRequirement(allowMetered: Boolean): NetworkRequirement =
    if (allowMetered) NetworkRequirement.CONNECTED else NetworkRequirement.UNMETERED

/** Runtime notification permission is only meaningful on Android 13 (API 33) and later. */
internal fun shouldRequestNotificationPermission(apiLevel: Int, permissionState: String?): Boolean =
    apiLevel >= 33 && permissionState == "prompt"

internal fun notificationPermissionStatus(
    apiLevel: Int,
    permissionState: String?,
): NotificationPermissionStatus = when {
    apiLevel < 33 -> NotificationPermissionStatus.NOT_REQUIRED
    permissionState == "granted" -> NotificationPermissionStatus.GRANTED
    else -> NotificationPermissionStatus.DENIED
}

internal fun executionResult(code: Int): ExecutionResult = when (code) {
    0 -> ExecutionResult.COMPLETED
    2 -> ExecutionResult.STOPPED
    else -> ExecutionResult.RETRY
}

internal fun controlAction(action: String?): ControlAction? = when (action) {
    ACTION_PAUSE -> ControlAction.PAUSE
    ACTION_CANCEL -> ControlAction.CANCEL
    else -> null
}

internal fun stablePlatformId(taskId: String, salt: Int = 0): Int {
    val candidate = (taskId.hashCode() xor salt) and Int.MAX_VALUE
    return candidate.takeUnless { it == 0 } ?: 1
}

internal fun nextAvailablePlatformId(
    taskId: String,
    occupiedIds: Set<Int>,
    salt: Int = 0,
): Int {
    var candidate = stablePlatformId(taskId, salt)
    repeat(occupiedIds.size + 1) {
        if (candidate !in occupiedIds) return candidate
        candidate = if (candidate == Int.MAX_VALUE) 1 else candidate + 1
    }
    error("No platform ID is available")
}

internal fun shouldRescheduleUidtJob(stoppedByUserOrApp: Boolean): Boolean =
    !stoppedByUserOrApp

internal fun validHeadlessEngineConfig(config: HeadlessEngineConfig): Boolean =
    config.version == ENGINE_CONFIG_VERSION &&
        java.io.File(config.databasePath).isAbsolute &&
        java.io.File(config.downloadDir).isAbsolute &&
        config.databasePath != config.downloadDir

internal fun rustBridgeClassCandidates(
    applicationPackage: String,
    launchActivityClass: String?,
): List<String> {
    val launchPackage = launchActivityClass
        ?.substringBeforeLast('.', missingDelimiterValue = "")
        ?.takeIf(String::isNotBlank)
    return listOfNotNull(launchPackage, applicationPackage.takeIf(String::isNotBlank))
        .distinct()
        .map { "$it.Rust" }
}
