<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { isArray } from 'es-toolkit/compat'
import { computed, shallowReadonly, shallowRef } from 'vue'

import { cn, usePreventBack, useZIndex, type StyleProps } from '../utils'

const $props = withDefaults(
  defineProps<
    {
      anchors?: 'high' | 'low' | number[]
      lockScroll?: boolean
      overlay?: boolean
      contentDraggable?: boolean
    } & StyleProps
  >(),
  { anchors: 'high', lockScroll: false, contentDraggable: false }
)

const isShow = shallowRef(false)
const { height: windowHeight } = useWindowSize()

const anchors = computed(() =>
  isArray($props.anchors)
    ? $props.anchors
    : $props.anchors === 'high'
      ? [
          0,
          Math.round(0.4 * windowHeight.value),
          Math.round(0.7 * windowHeight.value),
          windowHeight.value
        ]
      : [
          0,
          Math.round(0.3 * windowHeight.value),
          Math.round(0.6 * windowHeight.value),
          Math.round(0.9 * windowHeight.value)
        ]
)

const height = shallowRef(0)
const [zIndex, isLast] = useZIndex(
  computed({
    get() {
      return height.value > 0
    },
    set(show) {
      if (show) return (height.value = anchors.value[2])
      height.value = 0
    }
  })
)
usePreventBack(isShow, isLast)

defineExpose({
  show(node = 2) {
    height.value = anchors.value[node]
    isShow.value = true
  },
  close() {
    isShow.value = false
  },
  isShowing: shallowReadonly(isShow),
  height: shallowReadonly(height)
})

defineSlots<{ default(arg: { height: number }): void }>()
</script>

<template>
  <Teleport to="#popups">
    <VanOverlay :zIndex :isShow @click="isShow = false" v-if="overlay" />
    <Transition @after-leave="height = 0" name="van-slide-up">
      <VanFloatingPanel
        v-show="isShow"
        @heightChange="({ height }) => (height <= 0 ? (isShow = false) : (isShow = true))"
        :anchors
        v-model:height="height"
        :contentDraggable
        :lockScroll
        :style="[style, { zIndex }]"
        :class="
          cn(
            'overflow-hidden border-0 border-t border-solid border-(--van-border-color)',
            $props.class
          )
        "
      >
        <div
          class="w-full bg-(--van-background)"
          :style="{ height: `calc(${height}px - var(--van-floating-panel-header-height))` }"
        >
          <slot v-if="isShow" :height></slot>
        </div>
      </VanFloatingPanel>
    </Transition>
  </Teleport>
</template>