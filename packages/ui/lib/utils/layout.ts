import { useGlobalVar } from '@delta-comic/utils'
import { last, remove } from 'es-toolkit/compat'
import {
  computed,
  onUnmounted,
  shallowReactive,
  watch,
  type MaybeRefOrGetter,
  type ComputedRef,
  toRef
} from 'vue'

const allLayers = useGlobalVar(shallowReactive<symbol[]>([]), 'utils/layers')

/**
 * @description
 * 对于所有弹出层，使用其确定`z-index`
 * 在组件内使用时，卸载组件 _`(onUnmounted)`_ 会自动清理，否则需要主动调用`return[2]`清理
 *
 */
export const useZIndex = (
  show: MaybeRefOrGetter<boolean>
): [index: ComputedRef<number>, isLast: ComputedRef<boolean>, stopUse: () => void] => {
  const th = Symbol('layer')
  const isShow = toRef(show)
  const stop = watch(
    isShow,
    isShow => {
      if (isShow) {
        allLayers.push(th)
      } else {
        remove(<any>allLayers, t => t === th)
      }
    },
    { immediate: true }
  )
  try {
    onUnmounted(stop)
  } catch {}
  return [
    computed(() => (allLayers.indexOf(th) + 1) * 10),
    computed(() => last(allLayers) === th),
    stop
  ]
}