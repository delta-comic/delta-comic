import { Logger } from '@delta-comic/logger'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { isProxy } from 'vue'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../public/runtime/host-libraries.umd.js')
})

const { pageTypes } = vi.hoisted(() => ({
  pageTypes: new Map<string, new (...args: never[]) => unknown>(),
}))

vi.mock('@delta-comic/model', () => ({
  uni: {
    content: {
      ContentPage: {
        contentPages: {
          get: (key: string | [string, string]) =>
            pageTypes.get(typeof key === 'string' ? key : key.join(':')),
          key: {
            toString: (key: string | [string, string]) =>
              typeof key === 'string' ? key : key.join(':'),
          },
        },
      },
    },
  },
}))

import { useContentStore } from './content'

describe('content store page cache', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pageTypes.clear()
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined)
  })

  it('uses a stable sourced-type key across tuple and serialized inputs', () => {
    const store = useContentStore()

    expect(store.$createHistoryKey(['reader', 'comic'], 'comic-1', 'chapter-2')).toBe(
      'comic-1$reader:comic$chapter-2',
    )
    expect(store.$createHistoryKey('reader:comic', 'comic-1', 'chapter-2')).toBe(
      'comic-1$reader:comic$chapter-2',
    )
  })

  it('constructs each page once, preserves preload, and keeps class instances raw', () => {
    const constructorSpy = vi.fn()
    class TestPage {
      constructor(
        public preload: unknown,
        public id: string,
        public ep: string,
      ) {
        constructorSpy(preload, id, ep)
      }
    }
    pageTypes.set('reader:comic', TestPage as never)
    const store = useContentStore()
    const preload = { id: 'comic-1', title: 'Comic' }

    store.$load(['reader', 'comic'], 'comic-1', 'chapter-2', preload as never)
    store.$load('reader:comic', 'comic-1', 'chapter-2', { id: 'ignored' } as never)

    const cached = store.history.get('comic-1$reader:comic$chapter-2') as TestPage
    expect(constructorSpy).toHaveBeenCalledExactlyOnceWith(preload, 'comic-1', 'chapter-2')
    expect(cached).toMatchObject({ ep: 'chapter-2', id: 'comic-1', preload })
    expect(isProxy(cached)).toBe(false)
    expect(store.history.size).toBe(1)
  })

  it('separates episodes and fails immediately for an unregistered content type', () => {
    class TestPage {}
    pageTypes.set('reader:comic', TestPage as never)
    const store = useContentStore()

    store.$load('reader:comic', 'comic-1', 'chapter-1')
    store.$load('reader:comic', 'comic-1', 'chapter-2')
    expect(store.history.size).toBe(2)
    expect(() => store.$load('missing:type', 'comic-1', 'chapter-1')).toThrow()
    expect(store.history.size).toBe(2)
  })
})