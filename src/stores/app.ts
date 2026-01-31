import { useFullscreen } from "@vueuse/core"
import { defineStore } from "pinia"
import { shallowRef, watch, type Component, type VNode } from "vue"
import { shallowReactive } from "vue"
export const useAppStore = defineStore('app', () => {
  const isFullScreen = shallowRef(false)
  const fc = useFullscreen()
  watch(isFullScreen, isFullScreen => {
    if (isFullScreen) {
      fc.enter()
      return
    }
    fc.exit()
  }, { immediate: true })

  const renderRootNodes = shallowReactive<(VNode | Component)[]>([])
  return { isFullScreen, renderRootNodes }
})