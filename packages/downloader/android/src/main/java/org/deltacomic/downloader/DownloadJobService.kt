package org.deltacomic.downloader

import android.annotation.SuppressLint
import android.app.job.JobParameters
import android.app.job.JobService
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException

// UIDT jobs use a JobScheduler namespace, so their IDs cannot collide with WorkManager.
@SuppressLint("SpecifyJobSchedulerIdRange")
class DownloadJobService : JobService() {
    private class ActiveJob(val taskId: String) {
        @Volatile var future: Future<*>? = null
    }

    private val executor = Executors.newFixedThreadPool(MAX_UIDT_WORKERS)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val activeJobs = mutableMapOf<Int, ActiveJob>()

    override fun onStartJob(params: JobParameters): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return false
        val taskId = params.extras.getString(TASK_ID) ?: return false
        if (activeJobs.containsKey(params.jobId)) return false
        setNotification(
            params,
            params.jobId,
            DownloadRuntime.createNotification(this, taskId),
            JOB_END_NOTIFICATION_POLICY_REMOVE
        )
        val activeJob = ActiveJob(taskId)
        activeJobs[params.jobId] = activeJob
        return try {
            activeJob.future = executor.submit {
                val result = DownloadRuntime.run(this, taskId)
                mainHandler.post {
                    if (activeJobs[params.jobId] === activeJob) {
                        activeJobs.remove(params.jobId)
                        jobFinished(params, result == ExecutionResult.RETRY)
                    }
                }
            }
            true
        } catch (_: RejectedExecutionException) {
            activeJobs.remove(params.jobId)
            false
        }
    }

    override fun onStopJob(params: JobParameters): Boolean {
        val activeJob = activeJobs.remove(params.jobId)
        val taskId = activeJob?.taskId ?: params.extras.getString(TASK_ID)
        activeJob?.future?.cancel(true)
        if (taskId != null) {
            DownloadRuntime.dispatchControl(this, taskId, ControlAction.SYSTEM_STOP)
        }
        val stoppedByUserOrApp = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            (
                params.stopReason == JobParameters.STOP_REASON_USER ||
                    params.stopReason == JobParameters.STOP_REASON_CANCELLED_BY_APP
                )
        return shouldRescheduleUidtJob(stoppedByUserOrApp)
    }

    override fun onDestroy() {
        activeJobs.values.forEach { activeJob ->
            activeJob.future?.cancel(true)
            DownloadRuntime.dispatchControl(this, activeJob.taskId, ControlAction.SYSTEM_STOP)
        }
        activeJobs.clear()
        executor.shutdownNow()
        super.onDestroy()
    }

    companion object {
        const val TASK_ID = "taskId"
        private const val MAX_UIDT_WORKERS = 3
    }
}
