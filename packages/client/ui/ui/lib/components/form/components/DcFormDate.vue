<script setup lang="ts">
import type { FormDate, FormSingleResult } from '@delta-comic/model'
import { NDatePicker } from 'naive-ui'

defineProps<{ config: FormDate }>()

const store = defineModel<FormSingleResult<FormDate>>({ required: true })
</script>

<template>
  <NDatePicker
    input-readonly
    :format="config.format"
    :type="config.time ? 'date' : 'datetime'"
    v-model:formatted-value="store"
  />
</template>