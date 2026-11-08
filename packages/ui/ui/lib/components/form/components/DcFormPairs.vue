<script setup lang="ts">
import type { FormPairs, FormSingleResult } from '@delta-comic/model'
import { NDynamicInput, NInput } from 'naive-ui'
import { watch } from 'vue'

import { translateUi } from '../../../i18n'

const $props = defineProps<{ config: FormPairs }>()

const createItem = () => ({ ...($props.config.defaultValue?.[0] ?? { key: '', value: '' }) })

const store = defineModel<FormSingleResult<FormPairs>>({ required: true })
watch(
  [store, () => $props.config.noMultiple],
  ([value, noMultiple]) => {
    if (!noMultiple || value.length === 1) return
    store.value = value.length > 0 ? [value[0]!] : [createItem()]
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <NDynamicInput
    v-model:value="store"
    :on-create="() => createItem()"
    :min="config.noMultiple ? 1 : undefined"
    :max="config.noMultiple ? 1 : undefined"
    :show-sort-button="!config.noMultiple"
  >
    <template #default="{ value }">
      <div class="w-full items-center">
        <NInput
          v-model:value="value.key"
          class="w-2/3!"
          type="text"
          :placeholder="translateUi('form.pairs.keyPlaceholder')"
        />
        <NInput
          v-model:value="value.value"
          type="text"
          class="my-2"
          :placeholder="translateUi('form.pairs.valuePlaceholder')"
        />
      </div>
    </template>
  </NDynamicInput>
</template>