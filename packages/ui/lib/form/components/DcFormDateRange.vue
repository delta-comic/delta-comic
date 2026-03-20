<script setup lang="ts">
import { NDatePicker } from 'naive-ui'

import type { SingleResult, Type } from '@/form/type'

defineProps<{ config: Type.DateRange }>()


const store = defineModel<SingleResult<Type.DateRange>>({ required: true })
</script>

<template>
  <NDatePicker
    input-readonly
    :format="config.format"
    :type="config.time ? 'daterange' : 'datetimerange'"
    v-model:formatted-value="store"
  />
</template>