<script setup lang="ts">
import { NAlert, NButton, NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import type { SourceRefreshWarning } from '@/features/downloads/sourceRefresh'
import { Icons } from '@/icons'

defineProps<{ warnings: readonly SourceRefreshWarning[] }>()
const emit = defineEmits<{ confirm: [taskId: string]; retry: [taskId: string] }>()
const { t } = useI18n()
const retryableStatuses = new Set<SourceRefreshWarning['status']>([
  'content-page-construction-failed',
  'content-page-fingerprint-unavailable',
  'plugin-metadata-unavailable',
  'provider-fingerprint-unavailable',
  'refresh-failed',
])
</script>

<template>
  <div v-if="warnings.length" class="max-h-64 shrink-0 space-y-2 overflow-y-auto p-3">
    <NAlert
      v-for="warning in warnings"
      :key="warning.taskId"
      :title="t('download.sourceRefresh.title')"
      type="warning"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
        <div class="min-w-0 flex-1">
          <p class="font-medium break-words">{{ warning.taskTitle }}</p>
          <p v-if="warning.collectionTitle" class="mt-0.5 text-xs break-words opacity-70">
            {{ warning.collectionTitle }}
          </p>
          <p class="mt-1 text-xs break-words">
            {{ t(`download.sourceRefresh.statuses.${warning.status}`) }}
          </p>
          <ul v-if="warning.changes?.length" class="mt-1 list-disc pl-4 text-xs">
            <li v-for="change in warning.changes" :key="change.code">
              {{ t(`download.sourceRefresh.changes.${change.code}`) }}
            </li>
          </ul>
          <p class="mt-1 text-xs">{{ t('download.sourceRefresh.description') }}</p>
        </div>
        <div class="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap">
          <NButton
            v-if="warning.status === 'confirmation-required'"
            size="small"
            type="warning"
            @click="emit('confirm', warning.taskId)"
          >
            <template #icon
              ><NIcon><Icons.material.CheckRound /></NIcon
            ></template>
            {{ t('download.sourceRefresh.actions.confirm') }}
          </NButton>
          <NButton
            v-else-if="retryableStatuses.has(warning.status)"
            size="small"
            @click="emit('retry', warning.taskId)"
          >
            <template #icon
              ><NIcon><Icons.antd.CloudSyncOutlined /></NIcon
            ></template>
            {{ t('download.sourceRefresh.actions.retry') }}
          </NButton>
        </div>
      </div>
    </NAlert>
  </div>
</template>