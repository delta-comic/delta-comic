<script setup lang="ts" generic="T extends DataState<any, any, any>">
import { type DataState } from '@pinia/colada'
import { NSpin } from 'naive-ui'
import { type ClassNameValue } from 'tailwind-merge'

import { cn } from '@/utils'

import type { StyleProps } from '../utils'

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
    :class="cn('size-full!', $props.class)"
    :contentClass="cn('size-full!', $props.contentClass)"
    :show="state.status != 'success'"
    :delay="200"
  >
    <template #description v-if="state.status == 'error'">
      {{ state.error.message }}
    </template>
    <slot :data="state.data" />
  </NSpin>
</template>