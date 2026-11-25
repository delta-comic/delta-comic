<script setup lang="ts">
import type { FormRadio, FormSingleResult } from '@delta-comic/model'
import { NRadio, NRadioGroup, NSelect, NSpace } from 'naive-ui'

defineProps<{ config: FormRadio }>()

const store = defineModel<FormSingleResult<FormRadio>>({ required: true })
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