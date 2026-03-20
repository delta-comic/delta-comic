import { watchOnce } from '@vueuse/core'
import type { ImagePreviewOptions, ImagePreviewInstance } from 'vant'
import { computed, shallowRef } from 'vue'

import { useZIndex } from './layout'

export const showImagePreview = (
  images: string[],
  config: Omit<ImagePreviewOptions, 'images' | 'teleport'> = {}
) => {
  const isShowing = shallowRef(true)
  const [, , stopUse] = useZIndex(isShowing)
  const previewInstance = window.$api.showImagePreview({
    images,
    ...config,
    overlayClass: '!z-2147483646',
    className: '!z-2147483646',
    onClose() {
      isShowing.value = false
    },
    showIndex: images.length > 1,
    teleport: '#popups'
  }) as ImagePreviewInstance
  const stopRouterGuard = window.$router.beforeEach(() => (isShowing.value = false))
  watchOnce(isShowing, () => {
    stopRouterGuard()
    stopUse()
    previewInstance.show = false
  })
  return {
    isShowing: computed(() => previewInstance.show),
    close: () => {
      isShowing.value = false
    }
  }
}