<script setup lang="ts">
import { NAlert, useDialog, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Layout from '@/components/user/userLayout.vue'
import type {
  AddDownloadRequest,
  DownloadTask,
  DownloaderSettings,
} from '@/features/downloads/downloaderClient'
import { useDownloadManager } from '@/features/downloads/useDownloadManager'

import AddDownloadDialog from './AddDownloadDialog.vue'
import DownloadDetailDrawer from './DownloadDetailDrawer.vue'
import DownloadList from './DownloadList.vue'
import DownloadSettingsDrawer from './DownloadSettingsDrawer.vue'
import DownloadSourceRefreshWarnings from './DownloadSourceRefreshWarnings.vue'
import DownloadToolbar from './DownloadToolbar.vue'

const { filter, filteredTasks, query, store } = useDownloadManager()
const {
  aggregateSpeed,
  capabilities,
  destinations,
  error,
  loading,
  mutating,
  pausableTasks,
  selectedTask,
  selectedTaskDetail,
  sourceRefreshWarnings,
  settings,
} = storeToRefs(store)
const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const showAdd = shallowRef(false)
const showSettings = shallowRef(false)
const showDetail = shallowRef(false)

function reportError(cause: unknown) {
  message.error(
    t('download.errors.actionFailed', {
      error: cause instanceof Error ? cause.message : String(cause),
    }),
  )
}

async function perform(operation: () => Promise<unknown>) {
  try {
    await operation()
  } catch (cause) {
    reportError(cause)
  }
}

async function addDownload(request: AddDownloadRequest) {
  await perform(async () => {
    if (request.type === 'http') await store.enqueueUrl(request.input)
    else await store.enqueueTorrent(request.input)
    showAdd.value = false
    message.success(t('download.messages.added'))
  })
}

function openDetails(task: DownloadTask) {
  store.selectTask(task.id)
  showDetail.value = true
}

function confirmAction(
  content: string,
  task: DownloadTask,
  action: (id: string) => Promise<unknown>,
) {
  dialog.warning({
    content,
    negativeText: t('common.actions.cancel'),
    positiveText: t('common.actions.confirm'),
    title: t('common.dialog.warning'),
    onPositiveClick: () => perform(() => action(task.id)),
  })
}

function cancel(task: DownloadTask) {
  confirmAction(t('download.confirm.cancel'), task, store.cancelTask)
}

function forget(task: DownloadTask) {
  confirmAction(t('download.confirm.forget'), task, store.forgetTask)
}

function deleteFiles(task: DownloadTask) {
  confirmAction(t('download.confirm.deleteFiles'), task, async id => {
    await store.deleteTaskFiles(id)
    message.success(t('download.messages.filesDeleted'))
  })
}

async function saveSettings(patch: Partial<DownloaderSettings>) {
  await perform(async () => {
    await store.updateSettings(patch)
    showSettings.value = false
    message.success(t('download.messages.updated'))
  })
}

async function pickDestination() {
  await perform(async () => {
    const destination = await store.pickDestination()
    if (destination) message.success(t('download.destinations.added'))
  })
}

function performSelected(action: (task: DownloadTask) => Promise<unknown>) {
  const task = selectedTask.value
  if (task) void perform(() => action(task))
}
</script>

<template>
  <Layout :is-loading="loading" :title="t('download.title')">
    <main class="flex h-full min-h-0 flex-col bg-(--dc-background)">
      <DownloadToolbar
        v-model:filter="filter"
        v-model:query="query"
        :active-count="pausableTasks.length"
        :disabled="mutating"
        :speed="aggregateSpeed"
        @add="showAdd = true"
        @pause-all="perform(store.pauseAll)"
        @refresh="perform(store.refresh)"
        @settings="showSettings = true"
      />
      <NAlert v-if="error" closable class="m-3 shrink-0" type="error" @close="store.clearError">
        {{ t('download.errors.loadFailed', { error }) }}
      </NAlert>
      <DownloadSourceRefreshWarnings
        :warnings="sourceRefreshWarnings"
        @confirm="id => perform(() => store.confirmSourceRefresh(id))"
        @retry="id => perform(() => store.retrySourceRefresh(id))"
      />
      <div class="min-h-0 flex-1">
        <DownloadList
          :disabled="mutating"
          :tasks="filteredTasks"
          @cancel="cancel"
          @delete-files="deleteFiles"
          @details="openDetails"
          @forget="forget"
          @pause="task => perform(() => store.pauseTask(task.id))"
          @resume="task => perform(() => store.resumeTask(task.id))"
          @retry="task => perform(() => store.retryTask(task.id))"
        />
      </div>
    </main>
  </Layout>

  <AddDownloadDialog
    v-model:show="showAdd"
    :destinations
    :disabled="mutating"
    @submit="addDownload"
  />
  <DownloadSettingsDrawer
    v-model:show="showSettings"
    :destinations
    :capabilities
    :disabled="mutating"
    :settings
    @pick-destination="pickDestination"
    @save="saveSettings"
  />
  <DownloadDetailDrawer
    v-model:show="showDetail"
    :disabled="mutating"
    :task="selectedTask"
    :detail="selectedTaskDetail"
    @cancel="selectedTask && cancel(selectedTask)"
    @delete-files="selectedTask && deleteFiles(selectedTask)"
    @forget="selectedTask && forget(selectedTask)"
    @pause="performSelected(task => store.pauseTask(task.id))"
    @priority="value => performSelected(task => store.setPriority(task.id, value))"
    @resume="performSelected(task => store.resumeTask(task.id))"
    @retry="performSelected(task => store.retryTask(task.id))"
  />
</template>