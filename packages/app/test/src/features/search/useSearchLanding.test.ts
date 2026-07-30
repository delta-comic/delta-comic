import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { effectScope, type EffectScope } from 'vue'

const mocks = await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../../public/runtime/host-libraries.umd.js')
  const vueRuntimePath = '../../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  window.$$lib$$ = { ...window.$$lib$$, Vue } as typeof window.$$lib$$
  return {
    history: Vue.shallowRef<string[]>([]),
    hotSearch: new Map<string, unknown[]>(),
    plugins: new Map<string, unknown>(),
    routeCall: vi.fn(),
  }
})

vi.mock('@delta-comic/db', () => ({ useNativeStore: () => mocks.history }))
vi.mock('@delta-comic/plugin', () => ({
  Global: { hotSearch: mocks.hotSearch },
  usePluginStore: () => ({ plugins: mocks.plugins }),
}))
vi.mock('@delta-comic/utils', () => ({ SharedFunction: { call: mocks.routeCall } }))
vi.mock('@/symbol', () => ({ pluginName: 'app' }))

import { useSearchLanding } from '../../../../src/features/search/useSearchLanding'

describe('useSearchLanding', () => {
  let scope: EffectScope | undefined

  beforeEach(() => {
    mocks.history.value = []
    mocks.hotSearch.clear()
    mocks.plugins.clear()
    mocks.routeCall.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => scope?.stop())

  it('loads plugin hot searches and routes a selected item through its declared target', async () => {
    const fetchItems = vi.fn(async (signal: AbortSignal) => {
      expect(signal.aborted).toBe(false)
      return [{ badge: { text: 'New', tone: 'warning' as const }, text: 'Delta' }]
    })
    mocks.plugins.set('reader', { search: { methods: { title: { defaultSort: 'popular' } } } })
    mocks.hotSearch.set('reader', [
      { fetchItems, target: { method: 'title' }, title: 'Reader trending' },
    ])
    const onMissingTarget = vi.fn()
    scope = effectScope()
    const landing = scope.run(() => useSearchLanding({ onMissingTarget }))!

    await flushPromises()

    expect(landing.hotSearchSections.value).toHaveLength(1)
    expect(landing.hotSearchSections.value[0]).toMatchObject({
      plugin: 'reader',
      title: 'Reader trending',
    })
    await landing.selectHotSearchItem(
      landing.hotSearchSections.value[0],
      landing.hotSearchSections.value[0].items[0],
    )

    expect(mocks.history.value).toEqual(['Delta'])
    expect(mocks.routeCall).toHaveBeenCalledExactlyOnceWith(
      'routeToSearch',
      'Delta',
      ['reader', 'title'],
      'popular',
    )
    expect(onMissingTarget).not.toHaveBeenCalled()
  })

  it('does not persist or route input when no search method is available', async () => {
    const onMissingTarget = vi.fn()
    scope = effectScope()
    const landing = scope.run(() => useSearchLanding({ onMissingTarget }))!
    landing.query.value = 'missing target'

    await expect(landing.submit()).resolves.toBe(false)

    expect(onMissingTarget).toHaveBeenCalledOnce()
    expect(mocks.history.value).toEqual([])
    expect(mocks.routeCall).not.toHaveBeenCalled()
  })
})