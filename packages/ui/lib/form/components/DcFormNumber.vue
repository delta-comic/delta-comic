<script setup lang="ts">
import { NInputNumber } from 'naive-ui'

import type { SingleResult, Type } from '@/form/type'

defineProps<{ config: Type.Number }>()


const store = defineModel<SingleResult<Type.Number>>({ required: true })
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