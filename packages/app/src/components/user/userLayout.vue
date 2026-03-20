<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{ title: string; isLoading?: boolean }>(), { isLoading: false })
defineSlots<{ rightNav(): void; topNav(): void; bottomNav(): void; default(): void }>()
const topBarEl = useTemplateRef('topBarEl')
const height = ref(0)
useResizeObserver(topBarEl, () => {
  height.value = topBarEl.value?.getBoundingClientRect().height ?? 0
})
const $router = useRouter()
</script>

<template>
  <NSpin
    :show="isLoading"
    class="h-[calc(100%-var(--safe-area-inset-top))] w-full *:first:size-full"
  >
    <div class="w-full bg-(--van-background-2) pt-safe"></div>
    <div class="flex w-full flex-col bg-(--van-background-2)" ref="topBarEl">
      <div class="relative flex h-13 w-full items-center justify-center text-lg! font-bold">
        <VanIcon
          name="arrow-left"
          size="calc(var(--spacing) * 6)"
          class="van-haptics-feedback absolute! left-3"
          @click="$router.back()"
          color="var(--van-text-color-2)"
        />
        <span>{{ title }}</span>
        <div class="absolute right-0 flex h-full items-center justify-end gap-4 pr-2">
          <slot name="rightNav" />
        </div>
        <slot name="topNav" />
      </div>
      <slot name="bottomNav" />
    </div>
    <div class="h-[calc(100%-var(--top-bar-height))]! w-full">
      <slot />
    </div>
  </NSpin>
</template>
<style scoped lang="css">
* {
  --top-bar-height: calc(v-bind(height) * 1px);
}
</style>