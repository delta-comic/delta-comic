<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInputNumber,
  NProgress,
  NTag,
} from 'naive-ui'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DownloadTask, DownloadTaskDetail } from '@/features/downloads/downloaderClient'
import { formatBytes, taskEta, taskProgress, formatDuration } from '@/features/downloads/format'

import DownloadTaskActions from './DownloadTaskActions.vue'

const props = defineProps<{
  disabled?: boolean
  task?: DownloadTask
  detail?: DownloadTaskDetail
}>()
const emit = defineEmits<{
  cancel: []
  deleteFiles: []
  forget: []
  pause: []
  priority: [value: number]
  resume: []
  retry: []
}>()
const show = defineModel<boolean>('show', { required: true })
const { t } = useI18n()
const isDesktop = useMediaQuery('(min-width: 768px)')
const priority = shallowRef(5)

watch(
  () => props.task?.priority,
  value => {
    if (value != null) priority.value = value
  },
  { immediate: true },
)

const progress = computed(() => (props.task ? taskProgress(props.task) : 0))
const eta = computed(() => (props.task ? formatDuration(taskEta(props.task)) : undefined))
</script>

<template>
  <NDrawer
    v-model:show="show"
    class="bg-(--dc-background)!"
    :height="isDesktop ? undefined : '82vh'"
    :placement="isDesktop ? 'right' : 'bottom'"
    :width="isDesktop ? 480 : undefined"
  >
    <NDrawerContent v-if="task" closable :title="t('download.detail.title')">
      <div class="space-y-6">
        <section>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-base font-semibold break-words text-(--dc-text)">{{ task.title }}</h2>
              <p class="mt-1 text-xs break-all text-(--dc-text-secondary)">
                {{ task.relativePath }}
              </p>
            </div>
            <NTag :bordered="false">{{ t(`download.status.${task.status}`) }}</NTag>
          </div>
          <NProgress
            class="mt-4"
            :percentage="progress"
            :status="task.status === 'failed' ? 'error' : undefined"
          />
        </section>

        <NDescriptions bordered label-placement="left" :column="1" size="small">
          <NDescriptionsItem :label="t('download.fields.kind')">
            {{ t(`download.kinds.${task.kind}`) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('download.fields.downloaded')">
            {{ formatBytes(task.downloadedBytes) }} / {{ formatBytes(task.totalBytes) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('download.fields.speed')">
            {{ task.speedBytesPerSecond ? `${formatBytes(task.speedBytesPerSecond)}/s` : '—' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('download.fields.eta')">
            {{ eta ?? t('download.units.unknownTime') }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('download.detail.destination')">
            {{ task.finalPath ?? task.destinationId }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="t('download.fields.priority')">
            <NInputNumber
              v-model:value="priority"
              :disabled
              size="small"
              :min="1"
              :max="10"
              @update:value="value => value != null && emit('priority', value)"
            />
          </NDescriptionsItem>
          <NDescriptionsItem v-if="task.checksum" :label="t('download.detail.checksum')">
            <span class="font-mono text-xs break-all"
              >{{ task.checksum.algorithm }}:{{ task.checksum.value }}</span
            >
          </NDescriptionsItem>
          <template v-if="task.kind === 'torrent' && detail?.torrent">
            <NDescriptionsItem :label="t('download.detail.uploaded')">
              {{ formatBytes(detail.torrent.uploadedBytes) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('download.detail.peers')">
              {{ detail.torrent.peerCount }}
            </NDescriptionsItem>
          </template>
        </NDescriptions>

        <section
          v-if="task.errorMessage"
          class="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300"
        >
          <h3 class="font-semibold">{{ t('download.detail.error') }}</h3>
          <p class="mt-1 break-words">{{ task.errorMessage }}</p>
          <p v-if="task.errorCode" class="mt-1 font-mono text-xs">{{ task.errorCode }}</p>
        </section>

        <section>
          <h3 class="mb-2 text-sm font-semibold text-(--dc-text)">
            {{ t('download.detail.segments') }}
          </h3>
          <NEmpty
            v-if="!detail?.completedRanges.length"
            size="small"
            :description="t('download.detail.noSegments')"
          />
          <ul v-else class="max-h-48 space-y-1 overflow-auto text-xs text-(--dc-text-secondary)">
            <li
              v-for="range in detail.completedRanges"
              :key="`${range.start}-${range.end}`"
              class="flex justify-between gap-3 font-mono"
            >
              <span>{{ formatBytes(range.start) }}-{{ formatBytes(range.end) }}</span>
              <span>{{ formatBytes(range.end - range.start) }}</span>
            </li>
          </ul>
        </section>
      </div>
      <template #footer>
        <DownloadTaskActions
          :disabled
          :task
          @cancel="emit('cancel')"
          @delete-files="emit('deleteFiles')"
          @forget="emit('forget')"
          @pause="emit('pause')"
          @resume="emit('resume')"
          @retry="emit('retry')"
        />
      </template>
    </NDrawerContent>
  </NDrawer>
</template>