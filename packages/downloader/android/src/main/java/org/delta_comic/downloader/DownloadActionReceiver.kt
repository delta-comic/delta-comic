package org.delta_comic.downloader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DownloadActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(TASK_ID) ?: return
        val action = controlAction(intent.action) ?: return
        val pendingResult = goAsync()
        DownloadRuntime.dispatchControl(context, taskId, action, pendingResult::finish)
    }

    companion object {
        const val TASK_ID = "taskId"
    }
}
