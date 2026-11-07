package org.deltacomic.downloader

import android.Manifest
import android.app.Activity
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.PersistableBundle
import androidx.activity.result.ActivityResult
import androidx.annotation.RequiresApi
import androidx.documentfile.provider.DocumentFile
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class ScheduleOptions {
    lateinit var taskId: String
    var estimatedBytes: Long? = null
    var allowMetered: Boolean = true
}

@InvokeArg
class ConfigureOptions {
    var version: Int = 0
    lateinit var databasePath: String
    lateinit var downloadDir: String
}

data class ScheduleResult(val notificationPermission: String)
data class ConfigureResult(val configured: Boolean)
data class CredentialContextResult(val initialized: Boolean)
data class PickDestinationResult(
    val cancelled: Boolean,
    val id: String? = null,
    val label: String? = null,
    val uri: String? = null
)
data class DeleteExportResult(val deleted: Boolean)

@InvokeArg
class DeleteExportOptions {
    lateinit var treeUri: String
    lateinit var documentUri: String
}

@TauriPlugin(
    permissions = [
        Permission(
            strings = [Manifest.permission.POST_NOTIFICATIONS],
            alias = DownloaderPlugin.NOTIFICATION_PERMISSION_ALIAS
        )
    ]
)
class DownloaderPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun initializeCredentialContext(invoke: Invoke) {
        try {
            if (NativeBridge.initializeCredentialContext(activity.applicationContext) != 0) {
                invoke.reject("Android credential storage could not be initialized")
                return
            }
        } catch (_: UnsatisfiedLinkError) {
            invoke.reject("Android credential storage is unavailable")
            return
        }
        invoke.resolveObject(CredentialContextResult(initialized = true))
    }

    @Command
    fun pickDestination(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            .addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            .addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        startActivityForResult(invoke, intent, "destinationPicked")
    }

    @ActivityCallback
    fun destinationPicked(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            invoke.resolveObject(PickDestinationResult(cancelled = true))
            return
        }
        val data = result.data
        if (data == null) {
            invoke.reject("Android did not return a document tree")
            return
        }
        val treeUri = data.data
        if (treeUri == null || treeUri.scheme != "content") {
            invoke.reject("Android did not return a valid document tree")
            return
        }
        val requiredPermissionFlags =
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        if (data.flags and requiredPermissionFlags != requiredPermissionFlags) {
            invoke.reject("The selected document tree is not readable and writable")
            return
        }
        try {
            activity.contentResolver.takePersistableUriPermission(treeUri, requiredPermissionFlags)
            val label = DocumentFile.fromTreeUri(activity, treeUri)?.name
                ?.takeIf(String::isNotBlank)
                ?: activity.getString(R.string.download_destination_fallback)
            invoke.resolveObject(
                PickDestinationResult(
                    cancelled = false,
                    id = safDestinationId(treeUri.toString()),
                    label = label,
                    uri = treeUri.toString()
                )
            )
        } catch (error: SecurityException) {
            invoke.reject("Android could not persist access to the selected tree: ${error.message}")
        }
    }

    @Command
    fun deleteExported(invoke: Invoke) {
        val options = invoke.parseArgs(DeleteExportOptions::class.java)
        val result = SafDocuments.deleteExported(activity, options.treeUri, options.documentUri)
        if (result.succeeded) {
            invoke.resolveObject(DeleteExportResult(deleted = true))
        } else {
            invoke.reject(result.error ?: "Android could not delete the exported download")
        }
    }

    @Command
    fun configure(invoke: Invoke) {
        val options = invoke.parseArgs(ConfigureOptions::class.java)
        val config = HeadlessEngineConfig(
            version = options.version,
            databasePath = options.databasePath,
            downloadDir = options.downloadDir
        )
        if (!validHeadlessEngineConfig(config)) {
            invoke.reject("Android downloader headless configuration is invalid")
            return
        }
        if (!DownloadRuntime.persistEngineConfig(activity, config)) {
            invoke.reject("Android could not persist the downloader headless configuration")
            return
        }
        invoke.resolveObject(ConfigureResult(configured = true))
    }

    @Command
    fun schedule(invoke: Invoke) {
        val options = invoke.parseArgs(ScheduleOptions::class.java)
        if (options.taskId.isBlank()) {
            invoke.reject("Download task ID must not be empty")
            return
        }
        val estimatedBytes = options.estimatedBytes
        if (estimatedBytes != null && estimatedBytes < 0) {
            invoke.reject("Estimated download bytes must not be negative")
            return
        }

        val permissionState = getPermissionState(NOTIFICATION_PERMISSION_ALIAS)?.toString()
        if (shouldRequestNotificationPermission(Build.VERSION.SDK_INT, permissionState)) {
            requestPermissionForAlias(
                NOTIFICATION_PERMISSION_ALIAS,
                invoke,
                "scheduleAfterNotificationPermission"
            )
            return
        }
        scheduleAndResolve(invoke, options, permissionState)
    }

    @PermissionCallback
    fun scheduleAfterNotificationPermission(invoke: Invoke) {
        val options = invoke.parseArgs(ScheduleOptions::class.java)
        scheduleAndResolve(
            invoke,
            options,
            getPermissionState(NOTIFICATION_PERMISSION_ALIAS)?.toString()
        )
    }

    private fun scheduleAndResolve(invoke: Invoke, options: ScheduleOptions, permissionState: String?) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                if (!scheduleUidt(options)) {
                    invoke.reject("Android rejected the user-initiated download job")
                    return
                }
            } else {
                scheduleWorker(options)
            }
        } catch (error: SecurityException) {
            invoke.reject("Android denied permission to schedule the download: ${error.message}")
            return
        } catch (error: IllegalArgumentException) {
            invoke.reject("Android rejected the download constraints: ${error.message}")
            return
        } catch (error: IllegalStateException) {
            invoke.reject("Android could not schedule the download: ${error.message}")
            return
        }
        val permission = notificationPermissionStatus(Build.VERSION.SDK_INT, permissionState)
        invoke.resolveObject(ScheduleResult(permission.wireValue))
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    @Synchronized
    private fun scheduleUidt(options: ScheduleOptions): Boolean {
        val extras = PersistableBundle().apply {
            putString(DownloadJobService.TASK_ID, options.taskId)
        }
        val networkType = when (networkRequirement(options.allowMetered)) {
            NetworkRequirement.CONNECTED -> JobInfo.NETWORK_TYPE_ANY
            NetworkRequirement.UNMETERED -> JobInfo.NETWORK_TYPE_UNMETERED
        }
        // API 34 namespaces isolate our IDs from WorkManager's JobScheduler IDs.
        val scheduler = activity.getSystemService(JobScheduler::class.java)
            .forNamespace(UIDT_JOB_NAMESPACE)
        val pendingJobs = scheduler.allPendingJobs
        val jobId = pendingJobs
            .firstOrNull { it.extras.getString(DownloadJobService.TASK_ID) == options.taskId }
            ?.id
            ?: nextAvailablePlatformId(options.taskId, pendingJobs.mapTo(mutableSetOf()) { it.id })
        val info = JobInfo.Builder(
            jobId,
            ComponentName(activity, DownloadJobService::class.java)
        )
            .setRequiredNetworkType(networkType)
            .setUserInitiated(true)
            .setPersisted(true)
            .setExtras(extras)
            .apply {
                options.estimatedBytes?.takeIf { it > 0 }?.let {
                    setEstimatedNetworkBytes(it, 0)
                }
            }
            .build()
        return scheduler.schedule(info) == JobScheduler.RESULT_SUCCESS
    }

    private fun scheduleWorker(options: ScheduleOptions) {
        val networkType = when (networkRequirement(options.allowMetered)) {
            NetworkRequirement.CONNECTED -> NetworkType.CONNECTED
            NetworkRequirement.UNMETERED -> NetworkType.UNMETERED
        }
        val input = Data.Builder().putString(DownloadWorker.TASK_ID, options.taskId).build()
        val request = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setInputData(input)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(networkType)
                    .build()
            )
            .addTag("delta-download-${options.taskId}")
            .build()
        WorkManager.getInstance(activity).enqueueUniqueWork(
            "delta-download-${options.taskId}",
            ExistingWorkPolicy.KEEP,
            request
        )
    }

    companion object {
        const val NOTIFICATION_PERMISSION_ALIAS = "notifications"
        private const val UIDT_JOB_NAMESPACE = "delta-comic-downloader"
    }
}
