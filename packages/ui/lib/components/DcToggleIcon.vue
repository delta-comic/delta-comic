<script setup lang="ts">
import { onLongPress } from '@vueuse/core'
import { twMerge } from 'tailwind-merge'
import { type Component as _Component, watch } from 'vue'
import { useTemplateRef } from 'vue'

import type { StyleProps } from '../utils'
const $props = defineProps<
  {
    icon: _Component
    size?: string | number
    disChanged?: boolean
    rowMode?: boolean
    padding?: boolean
  } & StyleProps
>()
const $emit = defineEmits<{ change: [mode: boolean]; click: [to: boolean]; longClick: [] }>()
const isActive = defineModel<boolean>({ default: false })

watch(isActive, mode => $emit('change', mode))
const handleClick = () => {
  $emit('click', !isActive.value)
  if (!$props.disChanged) isActive.value = !isActive.value
}

const htmlRefHook = useTemplateRef('htmlRefHook')
onLongPress(
  htmlRefHook,
  () => {
    $emit('longClick')
  },
  { modifiers: { prevent: true } }
)
</script>

<template>
  <div
    :class="
      twMerge(
        'flex items-center justify-center **:transition-colors!',
        !rowMode && 'flex-col',
        padding && 'px-4'
      )
    "
    :style
    @click.stop="handleClick"
    ref="htmlRefHook"
  >
    <NIcon :size :color="isActive ? 'var(--p-color)' : 'var(--van-gray-7)'">
      <component :is="icon" />
    </NIcon>
    <span class="mt-1 text-xs text-(--van-text-color-2)">
      <slot />
    </span>
  </div>
</template>