<script setup lang="ts">
import type { DownloadTask } from '@delta-comic/client-app-core/features/downloads/downloaderClient'
import { useVirtualList } from '@vueuse/core'
import { NEmpty } from 'naive-ui'
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'

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
const source = toRef(props, 'tasks')
const { containerProps, list, wrapperProps } = useVirtualList(source, {
  itemHeight: 168,
  overscan: 6,
})

const empty = computed(() => props.tasks.length === 0)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
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
            class=""
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
</template>