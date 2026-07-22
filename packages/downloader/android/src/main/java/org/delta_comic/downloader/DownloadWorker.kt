package org.delta_comic.downloader

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

class DownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val taskId = inputData.getString(TASK_ID) ?: return Result.failure()
        setForeground(createForegroundInfo(taskId))
        return when (runCancellable(taskId)) {
            ExecutionResult.COMPLETED -> Result.success()
            ExecutionResult.RETRY -> Result.retry()
            ExecutionResult.STOPPED -> Result.failure()
        }
    }

    override suspend fun getForegroundInfo(): ForegroundInfo {
        val taskId = inputData.getString(TASK_ID) ?: "download"
        return createForegroundInfo(taskId)
    }

    private fun createForegroundInfo(taskId: String): ForegroundInfo {
        val notification = DownloadRuntime.createNotification(applicationContext, taskId)
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            ForegroundInfo(
                stablePlatformId(taskId),
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(stablePlatformId(taskId), notification)
        }
    }

    private suspend fun runCancellable(taskId: String): ExecutionResult =
        suspendCancellableCoroutine { continuation ->
            val future = DownloadRuntime.runAsync(applicationContext, taskId) { result ->
                if (continuation.isActive) continuation.resume(result)
            }
            continuation.invokeOnCancellation {
                future.cancel(true)
                DownloadRuntime.dispatchControl(
                    applicationContext,
                    taskId,
                    ControlAction.SYSTEM_STOP,
                )
            }
        }

    companion object { const val TASK_ID = "taskId" }
}
