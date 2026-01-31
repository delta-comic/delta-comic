<script setup lang='ts'>
import { useResizeObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  title: string
  isLoading?: boolean
}>(), {
  isLoading: false
})
defineSlots<{
  rightNav(): void
  topNav(): void
  bottomNav(): void
  default(): void
}>()
const topBarEl = useTemplateRef('topBarEl')
const height = ref(0)
useResizeObserver(topBarEl, () => {
  height.value = topBarEl.value?.getBoundingClientRect().height ?? 0
})
const $router = useRouter()
</script>

<template>
  <NSpin :show="isLoading" class="w-full h-[calc(100%-var(--safe-area-inset-top))] *:first:size-full">
    <div class="w-full pt-safe bg-(--van-background-2)"></div>
    <div class="flex flex-col w-full bg-(--van-background-2)" ref="topBarEl">
      <div class="w-full h-13 flex text-lg! font-bold items-center relative justify-center">
        <VanIcon name="arrow-left" size="calc(var(--spacing) * 6)" class="absolute! left-3 van-haptics-feedback"
          @click="$router.back()" color="var(--van-text-color-2)" />
        <span>{{ title }}</span>
        <div class="absolute right-0 h-full flex gap-4 pr-2 justify-end items-center">
          <slot name="rightNav" />
        </div>
        <slot name="topNav" />
      </div>
      <slot name="bottomNav" />
    </div>
    <div class="w-full h-[calc(100%-var(--top-bar-height))]!">
      <slot />
    </div>
  </NSpin>
</template>
<style scoped lang='css'>
* {
  --top-bar-height: calc(v-bind(height) * 1px);
}
</style>