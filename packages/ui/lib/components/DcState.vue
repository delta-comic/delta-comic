<script setup lang="ts" generic="T extends DataState<any, any, any>">
import { type DataState } from '@pinia/colada'
import { NSpin } from 'naive-ui'
import { twMerge, type ClassNameValue } from 'tailwind-merge'

import type { StyleProps } from '@/utils'

defineProps<
  {
    state: T
    contentClass?: ClassNameValue
  } & StyleProps
>()


defineSlots<{
  default(args: { data: T['data'] }): any
}>()
</script>

<template>
  <NSpin
    :style
    :class="twMerge('size-full!', $props.class)"
    :contentClass="twMerge('size-full!', $props.contentClass)"
    :show="state.status != 'success'"
    :delay="200"
  >
    <template #description v-if="state.status == 'error'">
      {{ state.error.message }}
    </template>
    <slot :data="state.data" />
  </NSpin>
</template>