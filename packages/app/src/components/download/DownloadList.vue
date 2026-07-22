<script setup lang="ts">
import { useMediaQuery, useVirtualList } from '@vueuse/core'
import { NEmpty, NProgress, NTag } from 'naive-ui'
import { computed, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DownloadTask } from '@/features/downloads/downloaderClient'
import { formatBytes, taskDisplayName, taskProgress } from '@/features/downloads/format'

import DownloadTaskActions from './DownloadTaskActions.vue'
import DownloadTaskCard from './DownloadTaskCard.vue'

const props = defineProps<{ disabled?: boolean; tasks: DownloadTask[] }>()
const emit = defineEmits<{
  cancel: [task: DownloadTask]
  deleteFiles: [task: DownloadTask]
  details: [task: DownloadTask]
  forget: [task: DownloadTask]
  pause: [task: DownloadTask]
  resume: [task: DownloadTask]
  retry: [task: DownloadTask]
}>()
const { t } = useI18n()
const isDesktop = useMediaQuery('(min-width: 768px)')
const source = toRef(props, 'tasks')
const { containerProps, list, scrollTo, wrapperProps } = useVirtualList(source, {
  itemHeight: () => (isDesktop.value ? 72 : 168),
  overscan: 6,
})

watch(isDesktop, () => scrollTo(0))

const empty = computed(() => props.tasks.length === 0)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      v-if="!empty"
      class="hidden h-11 shrink-0 grid-cols-[minmax(12rem,2fr)_7rem_minmax(10rem,1fr)_8rem_12rem] items-center gap-3 border-b border-(--dc-border) bg-(--dc-surface) px-4 text-xs font-medium text-(--dc-text-secondary) md:grid"
    >
      <span>{{ t('download.fields.name') }}</span>
      <span>{{ t('download.fields.status') }}</span>
      <span>{{ t('download.fields.progress') }}</span>
      <span>{{ t('download.fields.speed') }}</span>
      <span class="text-right">{{ t('common.actions.actions') }}</span>
    </div>
    <div v-if="empty" class="flex flex-1 items-center justify-center p-8">
      <NEmpty :description="t('download.empty.description')">
        <template #extra>
          <span class="text-sm font-medium text-(--dc-text)">{{ t('download.empty.title') }}</span>
        </template>
      </NEmpty>
    </div>
    <div v-else v-bind="containerProps" class="min-h-0 flex-1 overscroll-contain">
      <div v-bind="wrapperProps">
        <div v-for="item in list" :key="item.data.id">
          <DownloadTaskCard
            class="md:hidden"
            :disabled
            :task="item.data"
            @cancel="emit('cancel', item.data)"
            @delete-files="emit('deleteFiles', item.data)"
            @details="emit('details', item.data)"
            @forget="emit('forget', item.data)"
            @pause="emit('pause', item.data)"
            @resume="emit('resume', item.data)"
            @retry="emit('retry', item.data)"
          />
          <div
            class="hidden h-[72px] grid-cols-[minmax(12rem,2fr)_7rem_minmax(10rem,1fr)_8rem_12rem] items-center gap-3 border-b border-(--dc-border) px-4 md:grid"
          >
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-(--dc-text)">
                {{ taskDisplayName(item.data) }}
              </div>
              <div class="truncate text-xs text-(--dc-text-secondary)">
                {{ item.data.relativePath }}
              </div>
            </div>
            <NTag :bordered="false" size="small">
              {{ t(`download.status.${item.data.status}`) }}
            </NTag>
            <div class="min-w-0">
              <NProgress :percentage="taskProgress(item.data)" :show-indicator="false" />
              <div class="mt-1 truncate text-[11px] text-(--dc-text-secondary)">
                {{ formatBytes(item.data.downloadedBytes) }} /
                {{ formatBytes(item.data.totalBytes) }}
              </div>
            </div>
            <span class="text-xs text-(--dc-text-secondary)">
              {{
                item.data.speedBytesPerSecond
                  ? `${formatBytes(item.data.speedBytesPerSecond)}/s`
                  : '—'
              }}
            </span>
            <DownloadTaskActions
              :disabled
              :task="item.data"
              @cancel="emit('cancel', item.data)"
              @delete-files="emit('deleteFiles', item.data)"
              @details="emit('details', item.data)"
              @forget="emit('forget', item.data)"
              @pause="emit('pause', item.data)"
              @resume="emit('resume', item.data)"
              @retry="emit('retry', item.data)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>