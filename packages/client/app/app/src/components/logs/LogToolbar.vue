<script setup lang="ts">
import { NButton, NInput, NSelect } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { LOG_LEVELS, type LogLevelFilter } from '@/features/logs/model'

defineProps<{
  disabled?: boolean
  exportDisabled?: boolean
  exporting: boolean
  loading: boolean
}>()
const emit = defineEmits<{ export: []; refresh: [] }>()
const level = defineModel<LogLevelFilter>('level', { required: true })
const scopeQuery = defineModel<string>('scopeQuery', { required: true })
const { t } = useI18n()

const levelOptions = computed(() => [
  { label: t('settings.logs.filters.allLevels'), value: 'all' },
  ...LOG_LEVELS.map(value => ({ label: t(`settings.logs.levels.${value}`), value })),
])
</script>

<template>
  <div class="flex flex-col gap-2 border-b border-(--dc-border) bg-(--dc-surface) p-3">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <NSelect
        v-model:value="level"
        :aria-label="t('settings.logs.filters.level')"
        class="w-full! sm:w-36!"
        :options="levelOptions"
      />
      <NInput
        v-model:value="scopeQuery"
        :aria-label="t('settings.logs.filters.scope')"
        clearable
        class="min-w-0 flex-1"
        :placeholder="t('settings.logs.filters.scopePlaceholder')"
      />
      <div class="flex gap-2">
        <NButton class="flex-1 sm:flex-none" :disabled :loading @click="emit('refresh')">
          {{ t('settings.logs.actions.refresh') }}
        </NButton>
        <NButton
          class="flex-1 sm:flex-none"
          :disabled="disabled || exportDisabled"
          :loading="exporting"
          type="primary"
          @click="emit('export')"
        >
          {{ t('settings.logs.actions.export') }}
        </NButton>
      </div>
    </div>
  </div>
</template>