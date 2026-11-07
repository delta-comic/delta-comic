import { shallowRef, type ShallowRef } from 'vue'

import { useGlobalVar } from './var'

const isFullscreen = useGlobalVar(
  (() => {
    const isFc = shallowRef(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', () => {
      isFc.value = !!document.fullscreenElement
    })
    return isFc
  })(),
  'core/isFc',
)

export const useFullscreen = () => ({
  isFullscreen: isFullscreen as ShallowRef<boolean>,
  entry(): void {
    isFullscreen.value = true
  },
  exit(): void {
    isFullscreen.value = false
  },
  toggle(): void {
    isFullscreen.value = !isFullscreen.value
  },
})