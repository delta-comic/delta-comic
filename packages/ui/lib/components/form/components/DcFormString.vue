<script setup lang="ts">
import type { FormSingleResult, FormString } from '@delta-comic/model'
import { isEmpty } from 'es-toolkit/compat'
import { NInput } from 'naive-ui'

defineProps<{ config: FormString }>()

const store = defineModel<FormSingleResult<FormString>>({ required: true })
</script>

<template>
  <NInput
    clearable
    :allowInput="v => (config.patten ? config.patten.test(v) || isEmpty(v) : true)"
    :defaultValue="config.defaultValue"
    :placeholder="config.placeholder"
    v-model:value="store"
  />
</template>