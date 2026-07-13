<script setup lang="ts">
import type { FormPairs, FormSingleResult } from '@delta-comic/model'
import { NDynamicInput, NInput } from 'naive-ui'
import { watch } from 'vue'

import { translateUi } from '../../../i18n'

const $props = defineProps<{ config: FormPairs }>()

const createItem = () => ($props.config.defaultValue ?? [{ key: '', value: '' }])[0]

const store = defineModel<FormSingleResult<FormPairs>>({ required: true })
watch(store, store => {
  if (!$props.config.noMultiple) return
  if (store.length == 1) return
  if (store.length > 0) return store.push(createItem())
  store.pop()
})
</script>

<template>
  <NDynamicInput v-model:value="store" :on-create="() => createItem()" show-sort-button>
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