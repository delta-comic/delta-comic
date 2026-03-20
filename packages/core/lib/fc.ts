import { useGlobalVar } from '@delta-comic/utils'
import { shallowRef } from 'vue'

const isFullscreen = useGlobalVar(
  (() => {
    const isFc = shallowRef(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', () => {
      isFc.value = !!document.fullscreenElement
    })
    return isFc
  })(),
  'core/isFc'
)

export const useFullscreen = () => ({
  isFullscreen,
  entry() {
    isFullscreen.value = true
  },
  exit() {
    isFullscreen.value = false
  },
  toggle() {
    isFullscreen.value = !isFullscreen.value
  }
})