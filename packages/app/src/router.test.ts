import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { isNavigationFailureMock } = await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../public/runtime/host-libraries.umd.js')
  const isNavigationFailureMock = vi.fn((value: unknown) => value === 'aborted')
  window.$$lib$$.VR = { ...window.$$lib$$.VR, isNavigationFailure: isNavigationFailureMock }
  return { isNavigationFailureMock }
})

const { configState, contentLoad, definitions, setStatusBar } = vi.hoisted(() => ({
  configState: { dark: false },
  contentLoad: vi.fn(),
  definitions: new Map<string, (...args: never[]) => unknown>(),
  setStatusBar: vi.fn(async () => undefined),
}))

vi.mock('@delta-comic/model', () => ({
  SourcedValue: class SourcedValue {
    toString(value: string | [string, string]) {
      return typeof value === 'string' ? value : value.join(':')
    }
  },
  UniContentPage: {
    contentPages: {
      key: {
        toString: (value: string | [string, string]) =>
          typeof value === 'string' ? value : value.join(':'),
      },
    },
  },
}))

vi.mock('@delta-comic/plugin', () => ({
  useConfig: () => ({
    get isDark() {
      return configState.dark
    },
  }),
}))

vi.mock('@delta-comic/utils', () => ({
  SharedFunction: {
    define: (handler: (...args: never[]) => unknown, _plugin: string, name: string) =>
      definitions.set(name, handler),
  },
}))

vi.mock('@/platform', () => ({ setStatusBar }))
vi.mock('@/stores/content', () => ({ useContentStore: () => ({ $load: contentLoad }) }))
vi.mock('vue-router/auto-routes', () => ({
  handleHotUpdate: vi.fn(),
  routes: [
    { component: {}, name: 'default-a', path: '/default-a' },
    { component: {}, name: 'default-b', path: '/default-b' },
    { component: {}, meta: { statusBar: 'auto' }, name: 'auto-a', path: '/auto-a' },
    { component: {}, meta: { statusBar: 'auto' }, name: 'auto-b', path: '/auto-b' },
    { component: {}, meta: { statusBar: 'light' }, name: 'explicit', path: '/explicit' },
    {
      component: {},
      name: '/content/[contentType]/[id]/[ep]',
      path: '/content/:contentType/:id/:ep',
    },
    {
      component: {},
      name: '/search/[keyword]/[sort]/[method]',
      path: '/search/:keyword/:sort/:method',
    },
  ],
}))

import { router } from './router'

describe('application router', () => {
  beforeEach(() => {
    configState.dark = false
    contentLoad.mockClear()
    isNavigationFailureMock.mockClear()
    isNavigationFailureMock.mockImplementation((value: unknown) => value === 'aborted')
    setStatusBar.mockClear()
  })

  it('forces a navigation query and retries only aborted navigation attempts', async () => {
    const push = vi
      .spyOn(router, 'push')
      .mockResolvedValueOnce('aborted' as never)
      .mockResolvedValueOnce(undefined)

    await expect(
      router.force.push({ path: '/default-a', query: { source: 'test' } }),
    ).resolves.toBeUndefined()

    expect(push).toHaveBeenCalledTimes(2)
    expect(push.mock.calls[0][0]).toMatchObject({
      path: '/default-a',
      query: { force: 'true', source: 'test' },
    })
    expect(push.mock.calls[1][0]).toBe(push.mock.calls[0][0])
    expect(isNavigationFailureMock).toHaveBeenCalledTimes(2)
  })

  it('caps force-navigation retries when every attempt aborts', async () => {
    const replace = vi.spyOn(router, 'replace').mockResolvedValue('aborted' as never)

    await expect(router.force.replace('/default-a')).rejects.toThrow(
      'Navigation retry exceeded 20 attempts',
    )
    expect(replace).toHaveBeenCalledTimes(21)
  })

  it('registers routeToContent with cache preload before encoded navigation', async () => {
    const forcePush = vi.spyOn(router.force, 'push').mockResolvedValue(undefined)
    const routeToContent = definitions.get('routeToContent') as
      | ((
          contentType: string | [string, string],
          id: string,
          ep: string,
          preload: unknown,
        ) => Promise<unknown>)
      | undefined
    expect(routeToContent).toBeDefined()
    const preload = { id: 'preload' }

    await routeToContent?.(['reader', 'comic'], 'comic id', 'chapter 1', preload)

    expect(contentLoad).toHaveBeenCalledExactlyOnceWith(
      ['reader', 'comic'],
      'comic id',
      'chapter 1',
      preload,
    )
    expect(forcePush).toHaveBeenCalledExactlyOnceWith({
      name: '/content/[contentType]/[id]/[ep]',
      params: { contentType: 'reader:comic', ep: 'chapter%201', id: 'comic%20id' },
    })
  })

  it('registers routeToSearch with explicit and unknown source parameters', async () => {
    const forcePush = vi.spyOn(router.force, 'push').mockResolvedValue(undefined)
    forcePush.mockClear()
    const routeToSearch = definitions.get('routeToSearch') as
      | ((
          input: string,
          source: [string, string] | undefined,
          sort: string | undefined,
        ) => Promise<unknown>)
      | undefined
    expect(routeToSearch).toBeDefined()

    await routeToSearch?.('search text', ['reader', 'title'], 'popular')
    await routeToSearch?.('fallback', undefined, undefined)

    expect(forcePush).toHaveBeenNthCalledWith(1, {
      name: '/search/[keyword]/[sort]/[method]',
      params: { keyword: 'search%20text', method: 'reader:title', sort: 'popular' },
    })
    expect(forcePush).toHaveBeenNthCalledWith(2, {
      name: '/search/[keyword]/[sort]/[method]',
      params: { keyword: 'fallback', method: 'unknown', sort: 'unknown' },
    })
  })

  it('maps default, automatic and explicit status-bar modes against the active theme', async () => {
    configState.dark = false
    await router.push('/default-a')
    expect(setStatusBar).toHaveBeenLastCalledWith('dark')

    configState.dark = true
    await router.push('/default-b')
    expect(setStatusBar).toHaveBeenLastCalledWith('light')

    await router.push('/auto-a')
    expect(setStatusBar).toHaveBeenLastCalledWith('dark')

    configState.dark = false
    await router.push('/auto-b')
    expect(setStatusBar).toHaveBeenLastCalledWith('light')

    configState.dark = true
    await router.push('/explicit')
    expect(setStatusBar).toHaveBeenLastCalledWith('light')
    expect(setStatusBar).toHaveBeenCalledTimes(5)
  })
})