<script setup lang="ts">
import type { FormCheckbox, FormSingleResult } from '@delta-comic/model'
import { NCheckbox, NCheckboxGroup, NSelect, NSpace } from 'naive-ui'

defineProps<{ config: FormCheckbox }>()

const store = defineModel<FormSingleResult<FormCheckbox>>({ required: true })
</script>

<template>
  <NCheckboxGroup
    v-if="config.comp === 'checkbox'"
    v-model:value="store"
    :name="config.info"
    :defaultValue="config.defaultValue"
  >
    <NSpace>
      <NCheckbox :key="c.value" :value="c.value" v-for="c of config.selects">
        {{ c.label }}
      </NCheckbox>
    </NSpace>
  </NCheckboxGroup>
  <NSelect
    v-else
    virtualScroll
    multiple
    :options="config.selects"
    :defaultValue="config.defaultValue"
    v-model:value="store"
    :placeholder="config.placeholder"
    filterable
  />
</template>