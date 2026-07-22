package org.delta_comic.downloader

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors
import java.util.concurrent.Future

internal object DownloadRuntime {
    const val CHANNEL = "delta_download_transfers"
    private const val CONFIG_PREFERENCES = "delta_downloader_native_engine"
    private const val CONFIG_VERSION = "version"
    private const val CONFIG_DATABASE_PATH = "databasePath"
    private const val CONFIG_DOWNLOAD_DIR = "downloadDir"
    private const val PAUSE_REQUEST_SALT = 0x13579bdf
    private const val CANCEL_REQUEST_SALT = 0x2468ace
    private val controlExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "delta-download-control").apply { isDaemon = true }
    }
    private val transferExecutor = Executors.newCachedThreadPool { runnable ->
        Thread(runnable, "delta-download-worker").apply { isDaemon = true }
    }

    fun createNotification(context: Context, taskId: String): android.app.Notification {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL,
                context.getString(R.string.download_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            )
        )
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pause = createControlPendingIntent(context, taskId, ControlAction.PAUSE)
        val cancel = createControlPendingIntent(context, taskId, ControlAction.CANCEL)
        val builder = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(context.getString(R.string.download_notification_title))
            .setContentText(context.getString(R.string.download_notification_progress))
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_pause, context.getString(R.string.download_pause), pause)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, context.getString(R.string.download_cancel), cancel)
            .setProgress(0, 0, true)
        launch?.let {
            builder.setContentIntent(
                PendingIntent.getActivity(
                    context,
                    stablePlatformId(taskId),
                    it,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )
            )
        }
        return builder.build()
    }

    @SuppressLint("UseKtx")
    fun persistEngineConfig(context: Context, config: HeadlessEngineConfig): Boolean =
        context.getSharedPreferences(CONFIG_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putInt(CONFIG_VERSION, config.version)
            .putString(CONFIG_DATABASE_PATH, config.databasePath)
            .putString(CONFIG_DOWNLOAD_DIR, config.downloadDir)
            .commit()

    fun run(context: Context, taskId: String): ExecutionResult {
        if (!ensureNativeEngine(context)) return ExecutionResult.RETRY
        return try {
            val code = NativeBridge.runTask(taskId)
            if (code != SAF_EXPORT_REQUIRED) return executionResult(code)
            val instruction = NativeBridge.getSafExportInstruction(taskId)
            if (instruction == null) return ExecutionResult.RETRY
            val export = SafDocuments.export(context, instruction)
            if (!export.succeeded) {
                NativeBridge.failSafExport(taskId, export.error ?: "Unknown SAF export failure")
                return ExecutionResult.STOPPED
            }
            executionResult(NativeBridge.completeSafExport(taskId, export.value!!))
        } catch (_: UnsatisfiedLinkError) {
            ExecutionResult.RETRY
        }
    }

    fun runAsync(
        context: Context,
        taskId: String,
        onResult: (ExecutionResult) -> Unit,
    ): Future<*> = transferExecutor.submit { onResult(run(context, taskId)) }

    fun dispatchControl(
        context: Context,
        taskId: String,
        action: ControlAction,
        onFinished: () -> Unit = {},
    ) {
        controlExecutor.execute {
            try {
                if (!ensureNativeEngine(context)) return@execute
                when (action) {
                    ControlAction.PAUSE -> NativeBridge.pauseTask(taskId)
                    ControlAction.CANCEL -> NativeBridge.cancelTask(taskId)
                    ControlAction.SYSTEM_STOP -> NativeBridge.systemStopTask(taskId)
                }
                if (action != ControlAction.SYSTEM_STOP) {
                    NativeBridge.checkpointTask(taskId)
                }
            } catch (_: UnsatisfiedLinkError) {
                // The persisted active state is recovered to queued on the next native bootstrap.
            } finally {
                onFinished()
            }
        }
    }

    private fun ensureNativeEngine(context: Context): Boolean {
        val config = readEngineConfig(context) ?: return false
        if (!loadTauriNativeLibrary(context)) return false
        return try {
            initializeNativeEngine(
                initializeCredentialContext = {
                    NativeBridge.initializeCredentialContext(context.applicationContext)
                },
                bootstrap = { NativeBridge.bootstrap(config.databasePath, config.downloadDir) },
            )
        } catch (_: UnsatisfiedLinkError) {
            false
        }
    }

    private fun readEngineConfig(context: Context): HeadlessEngineConfig? {
        val preferences = context.getSharedPreferences(CONFIG_PREFERENCES, Context.MODE_PRIVATE)
        val config = HeadlessEngineConfig(
            version = preferences.getInt(CONFIG_VERSION, 0),
            databasePath = preferences.getString(CONFIG_DATABASE_PATH, null) ?: return null,
            downloadDir = preferences.getString(CONFIG_DOWNLOAD_DIR, null) ?: return null,
        )
        return config.takeIf(::validHeadlessEngineConfig)
    }

    private fun loadTauriNativeLibrary(context: Context): Boolean {
        val launchActivity = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.component
            ?.className
        for (className in rustBridgeClassCandidates(context.packageName, launchActivity)) {
            try {
                Class.forName(className, true, context.classLoader)
                return true
            } catch (_: ClassNotFoundException) {
                // Product flavors can change applicationId without changing the Rust class package.
            } catch (_: UnsatisfiedLinkError) {
                return false
            }
        }
        return false
    }

    private fun createControlPendingIntent(
        context: Context,
        taskId: String,
        action: ControlAction,
    ): PendingIntent {
        val (intentAction, requestSalt, actionPath) = when (action) {
            ControlAction.PAUSE -> Triple(ACTION_PAUSE, PAUSE_REQUEST_SALT, "pause")
            ControlAction.CANCEL -> Triple(ACTION_CANCEL, CANCEL_REQUEST_SALT, "cancel")
            ControlAction.SYSTEM_STOP -> error("System stops do not create notification actions")
        }
        val intent = Intent(context, DownloadActionReceiver::class.java)
            .setAction(intentAction)
            .setData(
                Uri.Builder()
                    .scheme("delta-comic-downloader")
                    .authority("task")
                    .appendPath(taskId)
                    .appendPath(actionPath)
                    .build()
            )
            .putExtra(DownloadActionReceiver.TASK_ID, taskId)
        return PendingIntent.getBroadcast(
            context,
            stablePlatformId(taskId, requestSalt),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}

internal object NativeBridge {
    external fun initializeCredentialContext(context: Context): Int
    external fun bootstrap(databasePath: String, downloadDir: String): Int
    external fun runTask(taskId: String): Int
    external fun getSafExportInstruction(taskId: String): String?
    external fun completeSafExport(taskId: String, documentUri: String): Int
    external fun failSafExport(taskId: String, message: String)
    external fun checkpointTask(taskId: String)
    external fun pauseTask(taskId: String)
    external fun cancelTask(taskId: String)
    external fun systemStopTask(taskId: String)
}

internal fun initializeNativeEngine(
    initializeCredentialContext: () -> Int,
    bootstrap: () -> Int,
): Boolean {
    if (initializeCredentialContext() != 0) return false
    return bootstrap() == 0
}

private const val SAF_EXPORT_REQUIRED = 3
