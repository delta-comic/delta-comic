import { useFullscreen } from "@vueuse/core"
import { defineStore } from "pinia"
import { shallowRef, watch, type Component, type VNode } from "vue"
import { shallowReactive } from "vue"
export const useAppStore = defineStore('app', () => {
  const isFullScreen = shallowRef(false)
  const fc = useFullscreen()
  watch(isFullScreen, async isFullScreen => {
    if (isFullScreen) {
      await fc.enter()
      return
    }
    await fc.exit()
  }, { immediate: true })

  const renderRootNodes = shallowReactive<(VNode | Component)[]>([])
  return { isFullScreen, renderRootNodes }
})