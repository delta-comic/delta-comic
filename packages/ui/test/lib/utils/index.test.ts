import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, nextTick, shallowRef } from 'vue'

import { cn, toUnionSource } from '../../../lib/utils/index'
import { usePreventBack } from '../../../lib/utils/layout'

describe('toUnionSource', () => {
  it('normalizes query state and delegates refresh operations', async () => {
    const refetch = vi.fn().mockResolvedValue('fetched-again')
    const refresh = vi.fn().mockResolvedValue('refreshed')
    const next = vi.fn().mockReturnValue('next')
    const source = toUnionSource({
      next,
      type: 'query',
      value: {
        data: shallowRef([{ id: 1 }]),
        error: shallowRef<Error | null>(null),
        isLoading: shallowRef(true),
        refetch,
        refresh,
      } as any,
    })

    expect(source).toMatchObject({ data: [{ id: 1 }], error: null, isDone: true, isLoading: true })
    await expect(source.refetch()).resolves.toBe('fetched-again')
    await expect(source.refresh()).resolves.toBe('refreshed')
    await expect(source.next()).resolves.toBe('next')
    expect(refetch).toHaveBeenCalledWith(false)
    expect(refresh).toHaveBeenCalledWith(false)
  })

  it('flattens infinite pages and loads the next page with cancellation', async () => {
    const loadNextPage = vi.fn().mockResolvedValue('loaded')
    const source = toUnionSource({
      type: 'infinite',
      value: {
        data: shallowRef({ pages: [[{ id: 1 }], [{ id: 2 }]] }),
        error: shallowRef(new Error('stale')),
        hasNextPage: shallowRef(true),
        isLoading: shallowRef(false),
        loadNextPage,
        refetch: vi.fn(),
        refresh: vi.fn(),
      } as any,
    })

    expect(source.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(source.isDone).toBe(false)
    expect(source.error?.message).toBe('stale')
    await source.next()
    expect(loadNextPage).toHaveBeenCalledWith({ cancelRefetch: true })
  })

  it('flattens stream page payloads and handles an exhausted source', async () => {
    const loadNextPage = vi.fn().mockResolvedValue(undefined)
    const source = toUnionSource({
      type: 'stream',
      value: {
        data: shallowRef({ pages: [{ data: [{ id: 1 }] }, { data: [{ id: 2 }] }] }),
        error: shallowRef(null),
        hasNextPage: shallowRef(false),
        isLoading: shallowRef(false),
        loadNextPage,
        refetch: vi.fn(),
        refresh: vi.fn(),
      } as any,
    })

    expect(source.data).toEqual([{ id: 1 }, { id: 2 }])
    expect(source.isDone).toBe(true)
    await source.next()
    expect(loadNextPage).toHaveBeenCalledWith({ cancelRefetch: true })
  })

  it('wraps array callbacks as promises and supplies no-op defaults', async () => {
    const refresh = vi.fn().mockReturnValue('done')
    const source = toUnionSource({ refresh, type: 'array', value: [1, 2] })

    expect(source).toMatchObject({ data: [1, 2], error: null, isDone: true, isLoading: false })
    await expect(source.refresh()).resolves.toBe('done')
    await expect(source.refetch()).resolves.toBeUndefined()
    await expect(source.next()).resolves.toBeUndefined()
  })
})

describe('layout utilities', () => {
  it('merges conflicting Tailwind classes predictably', () => {
    expect(cn('px-2 text-sm', ['hidden px-4'])).toBe('text-sm hidden px-4')
  })

  it('closes the active overlay before navigation and disposes the guard', async () => {
    let guard: ((to: { query: Record<string, string> }) => boolean) | undefined
    const stop = vi.fn()
    const beforeEach = vi.fn((nextGuard: typeof guard) => {
      guard = nextGuard
      return stop
    })
    const visible = shallowRef(true)
    Object.assign(window, { $router: { beforeEach } })

    const wrapper = mount(
      defineComponent({
        setup() {
          usePreventBack(visible)
          return () => null
        },
      }),
    )

    expect(beforeEach).toHaveBeenCalledOnce()
    expect(guard?.({ query: {} })).toBe(true)
    expect(visible.value).toBe(false)

    visible.value = true
    await nextTick()
    expect(guard?.({ query: { force: 'true' } })).toBe(true)
    expect(visible.value).toBe(false)

    wrapper.unmount()
    expect(stop).toHaveBeenCalledOnce()
    delete (window as any).$router
  })
})