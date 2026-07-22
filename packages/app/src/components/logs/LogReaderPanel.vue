<script setup lang="ts">
import { NAlert, NButton } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useLogReader } from '@/features/logs/useLogReader'

import LogContentViewer from './LogContentViewer.vue'
import LogFileList from './LogFileList.vue'
import LogToolbar from './LogToolbar.vue'

const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
const reader = useLogReader()
const levelModel = computed({ get: () => reader.level.value, set: reader.setLevel })
const scopeQueryModel = computed({ get: () => reader.scopeQuery.value, set: reader.setScopeQuery })
</script>

<template>
  <section
    class="flex h-[min(72dvh,48rem)] min-h-[28rem] w-full flex-col overflow-hidden rounded-xl border border-(--dc-border) bg-(--dc-surface)"
  >
    <header
      class="flex shrink-0 items-start justify-between gap-3 border-b border-(--dc-border) px-3 py-3 sm:px-4"
    >
      <div class="min-w-0">
        <h2 class="m-0 text-base font-semibold text-(--dc-text)">
          {{ t('settings.logs.title') }}
        </h2>
        <p class="mt-1 mb-0 text-xs text-(--dc-text-secondary)">
          {{ t('settings.logs.description') }}
        </p>
      </div>
      <NButton quaternary size="small" @click="emit('close')">
        {{ t('settings.logs.actions.close') }}
      </NButton>
    </header>
    <LogToolbar
      v-model:level="levelModel"
      v-model:scope-query="scopeQueryModel"
      :disabled="reader.loadingFiles.value"
      :export-disabled="reader.files.value.length === 0"
      :exporting="reader.exporting.value"
      :loading="reader.loadingFiles.value"
      @export="reader.exportAll"
      @refresh="reader.refresh"
    />
    <NAlert
      v-if="reader.error.value"
      class="m-3 mb-0 shrink-0"
      closable
      :title="t('settings.logs.error.title')"
      type="error"
      @close="reader.clearError"
    >
      {{ reader.error.value }}
    </NAlert>
    <NAlert
      v-if="reader.exportPath.value"
      class="m-3 mb-0 shrink-0 break-all"
      closable
      :title="t('settings.logs.export.success')"
      type="success"
    >
      {{ reader.exportPath.value }}
    </NAlert>
    <div
      class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[13rem_minmax(0,1fr)] desktop:grid-cols-[18rem_minmax(0,1fr)] desktop:grid-rows-1"
    >
      <LogFileList
        :files="reader.files.value"
        :loading="reader.loadingFiles.value"
        :selected-path="reader.selectedPath.value"
        @select="reader.selectFile"
      />
      <LogContentViewer
        :content="reader.filteredContent.value"
        :filtered="reader.hasActiveFilter.value"
        :loading="reader.loadingContent.value"
        :selected="Boolean(reader.selectedFile.value)"
        :truncated="reader.selectedLogTruncated.value"
      />
    </div>
  </section>
</template>