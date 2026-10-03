<script setup lang="ts">
import { formatBytes } from '@delta-comic/core/features/downloads/format'
import type { DownloadFilter } from '@delta-comic/core/features/downloads/useDownloadManager'
import { NButton, NInput, NSelect } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ activeCount: number; disabled?: boolean; speed: number }>()
const emit = defineEmits<{ add: []; pauseAll: []; refresh: []; settings: [] }>()
const query = defineModel<string>('query', { required: true })
const filter = defineModel<DownloadFilter>('filter', { required: true })
const { t } = useI18n()

const filterOptions = computed(() => [
  { label: t('common.filters.all'), value: 'all' },
  { label: t('download.filters.active'), value: 'active' },
  { label: t('download.filters.completed'), value: 'completed' },
  { label: t('download.filters.failed'), value: 'failed' },
])
</script>

<template>
  <div class="border-b border-dc-border bg-dc-surface px-3 py-3">
    <div class="mx-auto flex max-w-7xl flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <NInput
          v-model:value="query"
          clearable
          class="min-w-44 flex-1"
          :placeholder="t('download.filters.search')"
        />
        <NSelect v-model:value="filter" class="w-32!" :options="filterOptions" />
        <NButton :disabled @click="emit('refresh')">{{ t('common.actions.reload') }}</NButton>
        <NButton :disabled="disabled || activeCount === 0" @click="emit('pauseAll')">
          {{ t('download.actions.pauseAll') }}
        </NButton>
        <NButton :disabled type="primary" @click="emit('add')">
          {{ t('download.actions.add') }}
        </NButton>
        <NButton :disabled quaternary @click="emit('settings')">
          {{ t('download.actions.settings') }}
        </NButton>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-dc-text-secondary">
        <span>{{ t('download.stats.active', { count: activeCount }) }}</span>
        <span>{{ t('download.stats.speed', { speed: `${formatBytes(speed)}/s` }) }}</span>
      </div>
    </div>
  </div>
</template>