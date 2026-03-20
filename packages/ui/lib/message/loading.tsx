import { isFunction, delay } from 'es-toolkit'
import { type MaybeRefOrGetter, computed, isRef, watch } from 'vue'

export type LoadingInstance = ReturnType<typeof createLoadingMessage>
export const createLoadingMessage = (
  text: MaybeRefOrGetter<string> = '加载中',
  api = window.$message
) => {
  const data = computed(() => (isRef(text) ? text.value : isFunction(text) ? text() : text))
  let loading = api.loading(data.value, { duration: 0 })
  const stop = watch(data, text => {
    loading.content = text
  })
  let isDestroy = false
  async function bind<T extends PromiseLike<any>>(
    promise?: T,
    throwError?: false,
    successText?: string,
    failText?: string
  ): Promise<Awaited<T>>
  async function bind<T extends PromiseLike<any>>(
    promise?: T,
    throwError?: true,
    successText?: string,
    failText?: string
  ): Promise<Awaited<T> | undefined>
  async function bind<T extends PromiseLike<any>>(
    promise?: T,
    throwError = true,
    successText?: string,
    failText?: string
  ): Promise<Awaited<T> | undefined> {
    try {
      const res = await promise
      void ctx.success(successText)
      return res
    } catch (error) {
      void ctx.fail(failText)
      if (throwError) throw error
      return undefined
    }
  }
  const ctx = {
    bind,
    async success(text = '成功！', delayTime = 500) {
      stop()
      if (isDestroy || !loading) return
      isDestroy = true
      loading.type = 'success'
      loading.content = text
      await delay(delayTime)
      loading.destroy()
    },
    async fail(text = '失败！', delayTime = 500) {
      stop()
      if (isDestroy || !loading) return
      isDestroy = true
      loading.type = 'error'
      loading.content = text
      await delay(delayTime)
      loading.destroy()
    },
    async info(text: string, delayTime = 500) {
      stop()
      if (isDestroy || !loading) return
      isDestroy = true
      loading.type = 'info'
      loading.content = text
      await delay(delayTime)
      loading.destroy()
    },
    destroy() {
      stop()
      if (isDestroy || !loading) return
      isDestroy = true
      loading.destroy()
    },
    [Symbol.dispose]() {
      this.destroy()
    },
    instance: loading
  }
  return ctx
}