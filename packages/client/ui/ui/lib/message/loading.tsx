import { isFunction, delay } from 'es-toolkit'
import { type MaybeRefOrGetter, computed, isRef, watch } from 'vue'

import { translateUi } from '../i18n'

type LoadingMessageReactive = {
  content?: any
  type: 'default' | 'error' | 'info' | 'loading' | 'success' | 'warning'
  destroy(): void
}
type LoadingMessageApi = {
  loading(content: any, options?: { duration?: number }): LoadingMessageReactive
}
type LoadingBind = {
  <T extends PromiseLike<any>>(
    promise?: T,
    throwError?: true,
    successText?: string,
    failText?: string,
  ): Promise<Awaited<T>>
  <T extends PromiseLike<any>>(
    promise: T | undefined,
    throwError: false,
    successText?: string,
    failText?: string,
  ): Promise<Awaited<T> | undefined>
}
export type LoadingInstance = {
  bind: LoadingBind
  success(text?: string, delayTime?: number): Promise<void>
  fail(text?: string, delayTime?: number): Promise<void>
  info(text: string, delayTime?: number): Promise<void>
  destroy(): void
  [Symbol.dispose](): void
  instance: LoadingMessageReactive
}
export const createLoadingMessage = (
  text: MaybeRefOrGetter<string> = translateUi('status.loading'),
  api: LoadingMessageApi = window.$message,
): LoadingInstance => {
  const data = computed(() => (isRef(text) ? text.value : isFunction(text) ? text() : text))
  let loading = api.loading(data.value, { duration: 0 })
  const stop = watch(data, text => {
    loading.content = text
  })
  let isDestroy = false
  async function bind<T extends PromiseLike<any>>(
    promise?: T,
    throwError?: true,
    successText?: string,
    failText?: string,
  ): Promise<Awaited<T>>
  async function bind<T extends PromiseLike<any>>(
    promise: T | undefined,
    throwError: false,
    successText?: string,
    failText?: string,
  ): Promise<Awaited<T> | undefined>
  async function bind<T extends PromiseLike<any>>(
    promise?: T,
    throwError = true,
    successText?: string,
    failText?: string,
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
    async success(text = translateUi('feedback.success'), delayTime = 500) {
      stop()
      if (isDestroy || !loading) return
      isDestroy = true
      loading.type = 'success'
      loading.content = text
      await delay(delayTime)
      loading.destroy()
    },
    async fail(text = translateUi('feedback.failed'), delayTime = 500) {
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
    instance: loading,
  }
  return ctx
}