<script setup lang="ts">
import type { FormDateRange, FormSingleResult } from '@delta-comic/model'
import { NDatePicker } from 'naive-ui'

defineProps<{ config: FormDateRange }>()

const store = defineModel<FormSingleResult<FormDateRange>>({ required: true })
</script>

<template>
  <NDatePicker
    input-readonly
    :format="config.format"
    :type="config.time ? 'daterange' : 'datetimerange'"
    v-model:formatted-value="store"
  />
</template>