<script setup lang="ts">
import { NDatePicker } from 'naive-ui'

import type { SingleResult, Type } from '@/form/type'

defineProps<{ config: Type.Date }>()

const store = defineModel<SingleResult<Type.Date>>({ required: true })
</script>

<template>
  <NDatePicker
    input-readonly
    :format="config.format"
    :type="config.time ? 'date' : 'datetime'"
    v-model:formatted-value="store"
  />
</template>