<script setup lang="ts">
import { NCheckbox, NCheckboxGroup, NSelect, NSpace } from 'naive-ui'

import type { SingleResult, Type } from '@/form/type'

defineProps<{ config: Type.Checkbox }>()

const store = defineModel<SingleResult<Type.Checkbox>>({ required: true })
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