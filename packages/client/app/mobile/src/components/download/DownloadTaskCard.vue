<script setup lang="ts">
import DownloadTaskActions from '@delta-comic/client-app-core/components/download/DownloadTaskActions.vue'
import DownloadTaskInfo from '@delta-comic/client-app-core/components/download/DownloadTaskInfo.vue'
import type { DownloadTask } from '@delta-comic/client-app-core/features/downloads/downloaderClient'
import {
  formatBytes,
  formatDuration,
  taskDisplayName,
  taskEta,
  taskProgress,
  taskProgressIsIndeterminate,
} from '@delta-comic/client-app-core/features/downloads/format'
import { NProgress, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ disabled?: boolean; task: DownloadTask }>()
const emit = defineEmits<{
  cancel: []
  deleteFiles: []
  details: []
  forget: []
  pause: []
  resume: []
  retry: []
}>()
const { t } = useI18n()

const progress = computed(() => taskProgress(props.task))
const eta = computed(() => formatDuration(taskEta(props.task)))
const statusType = computed(() => {
  if (props.task.status === 'completed') return 'success'
  if (props.task.status === 'failed') return 'error'
  if (['downloading', 'seeding'].includes(props.task.status)) return 'info'
  if (['waitingForNetwork', 'waitingForSource'].includes(props.task.status)) return 'warning'
  return 'default'
})
</script>

<template>
  <article
    class="mx-3 my-1.5 flex h-39 flex-col justify-between rounded-xl border border-dc-border bg-dc-surface p-3 shadow-sm"
  >
    <div class="flex min-w-0 items-start justify-between gap-3">
      <DownloadTaskInfo :title="taskDisplayName(task)" :path="task.relativePath" />
      <NTag :bordered="false" :type="statusType" size="small">
        {{ t(`download.status.${task.status}`) }}
      </NTag>
    </div>
    <div>
      <div class="mb-1.5 flex justify-between text-xs text-dc-text-secondary">
        <span>{{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}</span>
        <span v-if="task.speedBytesPerSecond">{{ formatBytes(task.speedBytesPerSecond) }}/s</span>
        <span v-else>{{ eta ?? t('download.units.unknownTime') }}</span>
      </div>
      <NProgress
        :percentage="progress"
        :processing="taskProgressIsIndeterminate(task)"
        :show-indicator="false"
        :status="task.status === 'failed' ? 'error' : undefined"
      />
    </div>
    <DownloadTaskActions
      compact
      :disabled
      :task
      @cancel="emit('cancel')"
      @delete-files="emit('deleteFiles')"
      @details="emit('details')"
      @forget="emit('forget')"
      @pause="emit('pause')"
      @resume="emit('resume')"
      @retry="emit('retry')"
    />
  </article>
</template>