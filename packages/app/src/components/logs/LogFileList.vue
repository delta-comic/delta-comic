<script setup lang="ts">
import { NEmpty, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import { formatLogFileSize, type LogFileInfo } from '@/features/logs/model'

defineProps<{ files: readonly LogFileInfo[]; loading: boolean; selectedPath?: string }>()
const emit = defineEmits<{ select: [path: string] }>()
const { locale, t } = useI18n()

const formatModifiedAt = (value: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
</script>

<template>
  <aside
    :aria-label="t('settings.logs.files.title')"
    class="flex min-h-0 flex-col border-b border-(--dc-border) bg-(--dc-surface) desktop:border-r desktop:border-b-0"
  >
    <div
      class="shrink-0 border-b border-(--dc-border) px-3 py-2 text-xs font-semibold tracking-wide text-(--dc-text-secondary) uppercase"
    >
      {{ t('settings.logs.files.title') }}
    </div>
    <NSpin :show="loading" class="min-h-0! flex-1" content-class="h-full min-h-0">
      <div v-if="files.length" class="h-full overflow-y-auto overscroll-contain p-2">
        <button
          v-for="file in files"
          :key="file.path"
          :aria-current="file.path === selectedPath ? 'true' : undefined"
          class="mb-1.5 flex w-full dc-interactive flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors last:mb-0"
          :class="
            file.path === selectedPath
              ? 'border-(--p-color) bg-[color-mix(in_srgb,var(--p-color)_9%,transparent)]'
              : 'border-transparent hover:border-(--dc-border) hover:bg-[color-mix(in_srgb,var(--dc-text)_4%,transparent)]'
          "
          type="button"
          @click="emit('select', file.path)"
        >
          <span class="w-full truncate text-sm font-medium text-(--dc-text)">{{ file.name }}</span>
          <span
            class="flex w-full items-center justify-between gap-2 text-[11px] text-(--dc-text-secondary)"
          >
            <span class="truncate">{{ formatModifiedAt(file.modifiedAt) }}</span>
            <span class="shrink-0">{{ formatLogFileSize(file.size) }}</span>
          </span>
          <span v-if="file.archived" class="text-[11px] text-(--dc-text-tertiary)">
            {{ t('settings.logs.files.archived') }}
          </span>
        </button>
      </div>
      <div v-else class="flex h-full min-h-36 items-center justify-center p-4">
        <NEmpty :description="t('settings.logs.files.empty')" size="small" />
      </div>
    </NSpin>
  </aside>
</template>