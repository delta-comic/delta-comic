<script setup lang="ts">
import { NSwitch } from 'naive-ui'

import type { SingleResult, Type } from '@/form/type'

defineProps<{ config: Type.Switch }>()


const store = defineModel<SingleResult<Type.Switch>>({ required: true })
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