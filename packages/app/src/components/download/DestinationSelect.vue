<script setup lang="ts">
import { NFormItem, NSelect } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Destination } from '@/features/downloads/downloaderClient'

const props = defineProps<{ destinations: readonly Destination[]; disabled?: boolean }>()
const destinationId = defineModel<string | undefined>('destinationId')
const { t } = useI18n()

const options = computed(() =>
  props.destinations.map(destination => ({
    label: destination.isDefault
      ? t('download.destinations.defaultOption', { label: destination.label })
      : destination.label,
    value: destination.id,
  })),
)
</script>

<template>
  <NFormItem :label="t('download.destinations.field')">
    <NSelect
      v-model:value="destinationId"
      :aria-label="t('download.destinations.field')"
      :disabled="disabled || options.length === 0"
      :options
      :placeholder="t('download.destinations.none')"
    />
  </NFormItem>
</template>