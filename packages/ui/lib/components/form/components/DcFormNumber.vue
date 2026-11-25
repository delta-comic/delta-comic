<script setup lang="ts">
import type { FormNumber, FormSingleResult } from '@delta-comic/model'
import { NInputNumber } from 'naive-ui'

defineProps<{ config: FormNumber }>()

const store = defineModel<FormSingleResult<FormNumber>>({ required: true })
</script>

<template>
  <NInputNumber
    :precision="config.float ? undefined : 0"
    clearable
    :min="config.range?.[0]"
    :max="config.range?.[1]"
    :defaultValue="config.defaultValue"
    :placeholder="config.placeholder"
    v-model:value="store"
  />
</template>