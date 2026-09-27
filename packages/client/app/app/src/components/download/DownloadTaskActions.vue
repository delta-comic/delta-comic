<script setup lang="ts">
import { NButton, NDropdown, NSpace } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DownloadTask } from '@/features/downloads/downloaderClient'
import { activeDownloadStatuses, resumableDownloadStatuses } from '@/features/downloads/format'

const props = withDefaults(
  defineProps<{ compact?: boolean; disabled?: boolean; task: DownloadTask }>(),
  { compact: false, disabled: false },
)
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

const canPause = computed(
  () => activeDownloadStatuses.has(props.task.status) || props.task.status === 'queued',
)
const canResume = computed(
  () => resumableDownloadStatuses.has(props.task.status) && props.task.status !== 'failed',
)
const canRetry = computed(() => props.task.status === 'failed' || props.task.status === 'cancelled')
const canCancel = computed(() => !['cancelled', 'completed'].includes(props.task.status))

const menuOptions = computed(() => [
  { key: 'details', label: t('download.actions.details') },
  ...(canCancel.value ? [{ key: 'cancel', label: t('download.actions.cancel') }] : []),
  { key: 'forget', label: t('download.actions.forget') },
  { key: 'deleteFiles', label: t('download.actions.deleteFiles') },
])

function handleMenu(key: string) {
  if (key === 'details') emit('details')
  else if (key === 'cancel') emit('cancel')
  else if (key === 'forget') emit('forget')
  else if (key === 'deleteFiles') emit('deleteFiles')
}
</script>

<template>
  <NSpace :size="6" :wrap="false" justify="end">
    <NButton v-if="canPause" :disabled size="small" secondary @click="emit('pause')">
      {{ t('download.actions.pause') }}
    </NButton>
    <NButton v-else-if="canResume" :disabled size="small" type="primary" @click="emit('resume')">
      {{ t('download.actions.resume') }}
    </NButton>
    <NButton v-else-if="canRetry" :disabled size="small" type="primary" @click="emit('retry')">
      {{ t('download.actions.retry') }}
    </NButton>
    <NDropdown :disabled :options="menuOptions" trigger="click" @select="handleMenu">
      <NButton :aria-label="t('common.actions.more')" :disabled size="small" quaternary>
        {{ compact ? '•••' : t('common.actions.more') }}
      </NButton>
    </NDropdown>
  </NSpace>
</template>