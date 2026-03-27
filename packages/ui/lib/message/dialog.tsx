import { noop } from 'es-toolkit'
import type { DialogReactive, DialogOptions } from 'naive-ui'
import { type CSSProperties, shallowRef, watch } from 'vue'

import { useZIndex } from '../utils'

type PromiseWith<T, D> = Promise<T> & Partial<D>
export const createDialog = (options: DialogOptions & { style?: CSSProperties }) => {
  let success = noop
  let fail = noop
  const result: PromiseWith<void, { ins: DialogReactive }> = new Promise<void>((s, f) => {
    success = s
    fail = f
  })
  const show = shallowRef(true)
  const [zIndex, isLast, stopUse] = useZIndex(show)
  const stopStyleWatch = watch(zIndex, zIndex => ((dialog.style as CSSProperties).zIndex = zIndex))
  const stopRouterBreak = window.$router.beforeEach(to => {
    if (isLast) {
      failStop()
      const aim = window.$router.resolve(to)
      return aim.query.force == 'true'
    }
    return true
  })
  const stop = () => {
    stopStyleWatch()
    stopUse()
    stopRouterBreak()
    dialog.destroy()
    return (show.value = false)
  }
  const failStop = () => {
    fail()
    stop()
    return false
  }
  const successStop = () => {
    success()
    stop()
  }
  const dialog = window.$dialog.create({
    positiveText: '确定',
    negativeText: '取消',
    ...options,
    style: { ...(options.style as CSSProperties), zIndex: zIndex.value },
    async onClose() {
      if ((await options.onClose?.()) === false) return false
      else show.value = false
      failStop()
    },
    async onPositiveClick(e) {
      if ((await (options.onPositiveClick ?? noop)(e)) === false) return false
      else successStop()
    },
    async onNegativeClick(e) {
      const ret = await (options.onNegativeClick ?? noop)(e)
      if (ret) return ret
      else failStop()
    },
    onEsc() {
      options.onEsc?.()
      failStop()
    },
    onMaskClick(e) {
      options.onMaskClick?.(e)
      failStop()
    },
    onAfterLeave() {
      options.onAfterLeave?.()
      stop()
    }
  })
  result.ins = dialog
  return result
}