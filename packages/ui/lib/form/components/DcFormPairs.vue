<script setup lang="ts">
import { NDynamicInput, NInput } from 'naive-ui'
import { watch } from 'vue'

import type { SingleResult, Type } from '@/form/type'

const $props = defineProps<{ config: Type.Pairs }>()


const createItem = () => ($props.config.defaultValue ?? [{ key: '', value: '' }])[0]


const store = defineModel<SingleResult<Type.Pairs>>({ required: true })
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
        <NInput v-model:value="value.key" class="w-2/3!" type="text" placeholder="插件ID" />
        <NInput v-model:value="value.value" type="text" class="my-2" placeholder="下载语句" />
      </div>
    </template>
  </NDynamicInput>
</template>