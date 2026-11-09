<script setup lang="ts">
import type { FormSingleResult, FormSwitch } from '@delta-comic/model'
import { NSwitch } from 'naive-ui'

defineProps<{ config: FormSwitch }>()

const store = defineModel<FormSingleResult<FormSwitch>>({ required: true })
</script>

<template>
  <NSwitch :defaultValue="config.defaultValue" v-model:value="store">
    <template #checked v-if="config.open">
      {{ config.open }}
    </template>
    <template #unchecked v-if="config.close">
      {{ config.close }}
    </template>
  </NSwitch>
</template>