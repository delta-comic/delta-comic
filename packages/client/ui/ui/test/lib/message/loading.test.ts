import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick, shallowRef } from 'vue'

import { createLoadingMessage } from '../../../lib/message/loading'

afterEach(() => vi.useRealTimers())

const createApi = () => {
  const instance = {
    content: '' as any,
    destroy: vi.fn(),
    type: 'loading' as const as 'default' | 'error' | 'info' | 'loading' | 'success' | 'warning',
  }
  const api = { loading: vi.fn(() => instance) }
  return { api, instance }
}

describe('createLoadingMessage', () => {
  it('opens a persistent message and follows reactive text', async () => {
    const text = shallowRef('Starting')
    const { api, instance } = createApi()
    const loading = createLoadingMessage(text, api)

    expect(api.loading).toHaveBeenCalledWith('Starting', { duration: 0 })
    text.value = 'Almost done'
    await nextTick()
    expect(instance.content).toBe('Almost done')

    loading.destroy()
    loading.destroy()
    expect(instance.destroy).toHaveBeenCalledOnce()
  })

  it.each([
    ['success', 'Saved', 'success'],
    ['fail', 'No connection', 'error'],
    ['info', 'Queued', 'info'],
  ] as const)('transitions through %s before destroying', async (method, text, type) => {
    vi.useFakeTimers()
    const { api, instance } = createApi()
    const loading = createLoadingMessage('Working', api)
    const transition = loading[method](text, 25)

    expect(instance.type).toBe(type)
    expect(instance.content).toBe(text)
    expect(instance.destroy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(25)
    await transition
    expect(instance.destroy).toHaveBeenCalledOnce()
  })

  it('uses localized defaults for success and failure', async () => {
    vi.useFakeTimers()
    const success = createApi()
    const successLoading = createLoadingMessage(undefined, success.api)
    const successful = successLoading.success(undefined, 0)
    await vi.runAllTimersAsync()
    await successful
    expect(success.instance.content).toBe('Success!')

    const failure = createApi()
    const failureLoading = createLoadingMessage(undefined, failure.api)
    const failed = failureLoading.fail(undefined, 0)
    await vi.runAllTimersAsync()
    await failed
    expect(failure.instance.content).toBe('Failed!')
  })

  it('binds a successful promise and returns its value', async () => {
    vi.useFakeTimers()
    const { api, instance } = createApi()
    const loading = createLoadingMessage('Loading', api)

    await expect(loading.bind(Promise.resolve({ id: 1 }), true, 'Loaded')).resolves.toEqual({
      id: 1,
    })
    expect(instance.type).toBe('success')
    expect(instance.content).toBe('Loaded')
    await vi.runAllTimersAsync()
    expect(instance.destroy).toHaveBeenCalledOnce()
  })

  it('can either rethrow or suppress a bound rejection', async () => {
    vi.useFakeTimers()
    const throwing = createApi()
    const throwingLoading = createLoadingMessage('Loading', throwing.api)
    await expect(
      throwingLoading.bind(Promise.reject(new Error('failed')), true, undefined, 'Try again'),
    ).rejects.toThrow('failed')
    expect(throwing.instance.type).toBe('error')
    expect(throwing.instance.content).toBe('Try again')

    const suppressed = createApi()
    const suppressedLoading = createLoadingMessage('Loading', suppressed.api)
    await expect(
      suppressedLoading.bind(Promise.reject(new Error('ignored')), false),
    ).resolves.toBeUndefined()
    expect(suppressed.instance.type).toBe('error')
    await vi.runAllTimersAsync()
  })

  it('supports disposal and ignores transitions after destruction', async () => {
    const { api, instance } = createApi()
    const loading = createLoadingMessage('Loading', api)
    loading[Symbol.dispose]()

    await loading.success('late', 0)
    await loading.fail('late', 0)
    await loading.info('late', 0)
    expect(instance.destroy).toHaveBeenCalledOnce()
    expect(instance.content).not.toBe('late')
  })
})