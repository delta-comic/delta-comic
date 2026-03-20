<script setup lang="ts">
import { NRadio, NRadioGroup, NSelect, NSpace } from 'naive-ui'

import type { SingleResult, Type } from '@/form/type'

defineProps<{ config: Type.Radio }>()

const store = defineModel<SingleResult<Type.Radio>>({ required: true })
</script>

<template>
  <NRadioGroup
    v-if="config.comp === 'radio'"
    v-model:value="store"
    :name="config.info"
    :defaultValue="config.defaultValue"
  >
    <NSpace>
      <NRadio :key="c.value" :value="c.value" v-for="c of config.selects"> {{ c.label }}</NRadio>
    </NSpace>
  </NRadioGroup>
  <NSelect
    v-else
    virtualScroll
    :options="config.selects"
    :defaultValue="config.defaultValue"
    v-model:value="store"
    :placeholder="config.placeholder"
    filterable
  />
</template>