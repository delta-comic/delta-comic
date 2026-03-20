import { useGlobalVar } from '@delta-comic/utils'
import { tryOnUnmounted, type AnyFn } from '@vueuse/core'
import { computed, shallowReactive, watch, type ComputedRef, type WatchHandle, type Ref } from 'vue'
import { useRouter } from 'vue-router'

const allLayers = useGlobalVar(shallowReactive<symbol[]>([]), 'utils/layers')

export type LayerIndex = [
  index: ComputedRef<number>,
  isLast: ComputedRef<boolean>,
  watcher: WatchHandle
]
/**
 * @description
 * 对于所有弹出层，使用其确定`z-index`
 * 在组件内使用时，卸载组件 _`(tryOnUnmounted)`_ 会自动清理，否则需要主动调用`[2].stop()`清理
 */
export const useZIndex = (isShow: Ref<boolean>): LayerIndex => {
  const symbol = Symbol('layer')
  const watcher = watch(
    isShow,
    isShow => {
      if (isShow) {
        allLayers.push(symbol)
        return
      }
      allLayers.splice(allLayers.indexOf(symbol), 1)
    },
    { immediate: true }
  )
  tryOnUnmounted(() => watcher.stop())
  const zIndex = computed(() => (allLayers.indexOf(symbol) + 1) * 10)
  const isLast = computed(() => allLayers.at(-1) === symbol)
  return [zIndex, isLast, watcher]
}
/**
 * @description
 * 与`useZIndex`函数配合，使得弹出层在显示时会阻止替换路由返回。
 * 同时还会自动处理force路由
 */
export const usePreventBack = (isShow: Ref<boolean>, isLast: Ref<boolean>) => {
  let stopRouter: AnyFn | undefined
  const $router = window.$router ?? useRouter()
  const watcher = watch(
    isShow,
    _isShow => {
      if (!_isShow) return stopRouter?.()
      stopRouter ??= $router.beforeEach(to => {
        if (to.query['force'] == 'true') {
          watcher.stop()
          stopRouter?.()
          isShow.value = false
          return true
        }
        if (!isLast.value || !isShow.value) return
        return (isShow.value = false)
      })
    },
    { immediate: true }
  )
  tryOnUnmounted(() => watcher.stop())
  return watcher
}