<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { isArray, noop } from 'es-toolkit/compat'
import { computed, shallowReadonly, shallowRef, type StyleValue, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useZIndex } from '@/utils'
const $router = useRouter()
const $props = withDefaults(
  defineProps<{
    anchors?: 'high' | 'low' | number[]
    lockScroll?: boolean
    class?: any
    style?: StyleValue
    overlay?: boolean
  }>(),
  { anchors: 'high', lockScroll: false }
)
const show = shallowRef(false)
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
const [zIndex, isLast] = useZIndex(() => height.value > 0)


// 路由拦截
let stopRouterBreak = noop
watch(show, () => {
  if (show.value)
    stopRouterBreak = $router.beforeEach(() => (isLast.value ? (show.value = false) : undefined))
  else stopRouterBreak()
})
onBeforeRouteLeave(stopRouterBreak)


defineExpose({
  show(node = 2) {
    height.value = anchors.value[node]
    show.value = true
  },
  close() {
    show.value = false
  },
  isShowing: shallowReadonly(show),
  height: shallowReadonly(height)
})
defineSlots<{ default(arg: { height: number }): void }>()
</script>

<template>
  <Teleport to="#popups">
    <VanOverlay :zIndex :show @click="show = false" v-if="overlay" />
    <Transition @after-leave="height = 0" name="van-slide-up">
      <VanFloatingPanel
        v-show="show"
        @height-change="({ height }) => height <= 0 && (show = false)"
        :anchors
        v-model:height="height"
        :content-draggable="false"
        :lock-scroll
        :style="[style, { zIndex }]"
        :class
        class="overflow-hidden border-0 border-t border-solid border-(--van-border-color)"
      >
        <div
          class="w-full bg-(--van-background)"
          :style="{ height: `calc(${height}px - var(--van-floating-panel-header-height))` }"
        >
          <slot v-if="height != 0" :height="height!"></slot>
        </div>
      </VanFloatingPanel>
    </Transition>
  </Teleport>
</template>