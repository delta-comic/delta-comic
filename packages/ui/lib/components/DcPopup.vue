<script setup lang="ts">
import { twMerge } from 'tailwind-merge'
import type { PopupProps } from 'vant'

import type { StyleProps } from '@/utils'
import { usePreventBack, useZIndex } from '@/utils/layout'

const $props = withDefaults(defineProps<Partial<PopupProps & StyleProps>>(), {
  position: 'center',
  overlay: true,
  closeOnClickOverlay: true,
  teleport: '#popups',
  destroyOnClose: true
})


const isShow = defineModel<boolean>('show', { required: true })
const [zIndex, isLast] = useZIndex(isShow)
usePreventBack(isShow, isLast)


defineSlots<{ default(): void }>()
defineEmits<{ closed: [] }>()
defineExpose({ zIndex })
</script>

<template>
  <VanPopup
    :="$props"
    v-model:show="isShow"
    :zIndex
    @closed="$emit('closed')"
    :class="twMerge('max-h-screen overflow-x-hidden overflow-y-auto!', $props.class)"
  >
    <slot></slot>
  </VanPopup>
</template>