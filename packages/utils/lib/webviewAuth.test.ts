import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { WebviewAuthResult } from './webviewAuth'
import './test/setup'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: mocks.isTauri }))

const storage = (entries: Record<string, string>) =>
  Object.entries(entries).map(([key, value]) => ({ key, value }))

const snapshot = (callback: unknown = null) => ({
  callback,
  collectedAt: 1,
  cookie: 'fallback=1',
  errors: [],
  frameId: 'top',
  href: 'https://auth.test/login',
  localStorage: storage({ fallbackLocal: '1' }),
  origin: 'https://auth.test',
  reason: 'snapshot',
  sessionStorage: storage({ fallbackSession: '1' }),
  title: 'Login',
  top: true,
})

describe('webviewAuth', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    mocks.isTauri.mockReset().mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the utils plugin command wrapper with camelCase options', async () => {
    const page = { label: 'delta-auth-1', url: 'https://auth.test/login' }
    mocks.invoke.mockResolvedValue(page)

    const { openWebviewPage } = await import('./webviewAuth')
    const result = await openWebviewPage({
      callbackName: 'authCallback',
      css: 'body { color: red; }',
      js: 'callback(true)',
      title: 'Login',
      url: page.url,
    })

    expect(result).toBe(page)
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:utils|webview_open_page', {
      options: {
        callbackName: 'authCallback',
        css: 'body { color: red; }',
        js: 'callback(true)',
        title: 'Login',
        url: page.url,
      },
    })
  })

  it('forwards every data and lifecycle command through the plugin boundary', async () => {
    mocks.invoke.mockResolvedValue(undefined)

    const {
      closeCurrentWebviewPage,
      closeWebviewPage,
      getAllWebviewAuthData,
      getCurrentWebviewAuthData,
      getWebviewAuthData,
      getWebviewIframeAuthData,
      injectWebviewCode,
      storageEntriesToRecord,
    } = await import('./webviewAuth')

    await injectWebviewCode({ callbackName: 'complete', label: 'auth', js: 'complete()' })
    await closeCurrentWebviewPage()
    await closeWebviewPage('auth')
    await getCurrentWebviewAuthData()
    await getWebviewAuthData('auth')
    await getAllWebviewAuthData()
    await getWebviewIframeAuthData('auth', 250)

    expect(mocks.invoke.mock.calls).toEqual([
      [
        'plugin:utils|webview_inject_code',
        { options: { callbackName: 'complete', label: 'auth', js: 'complete()' } },
      ],
      ['plugin:utils|webview_close_current_page', {}],
      ['plugin:utils|webview_close_page', { label: 'auth' }],
      ['plugin:utils|webview_auth_data_current', {}],
      ['plugin:utils|webview_auth_data', { label: 'auth' }],
      ['plugin:utils|webview_auth_data_all', {}],
      ['plugin:utils|webview_iframe_auth_data', { label: 'auth', waitMs: 250 }],
    ])
    expect(
      storageEntriesToRecord([
        { key: 'duplicate', value: 'old' },
        { key: 'duplicate', value: 'new' },
      ]),
    ).toEqual({ duplicate: 'new' })
  })

  it('replays terminal events to late subscribers and emits each terminal state once', async () => {
    const { WebviewAuth } = await import('./webviewAuth')
    type Result = WebviewAuthResult<{ ok: boolean }>

    class TestWebviewAuth extends WebviewAuth<{ ok: boolean }> {
      public async mount(): Promise<Result> {
        throw new Error('unused')
      }

      public async unmount() {}

      public complete(result: Result) {
        this.done(result)
      }

      public reject(error: unknown) {
        this.fail(error)
      }
    }

    const auth = new TestWebviewAuth('https://auth.test', { css: '', js: '' })
    const result: Result = {
      callbackValue: { ok: true },
      cookie: '',
      href: 'https://auth.test',
      localStorage: {},
      sessionStorage: {},
      title: '',
    }
    const earlyDone = vi.fn()
    const lateDone = vi.fn()
    const earlyError = vi.fn()
    const lateError = vi.fn()
    const error = new Error('authorization failed')
    auth.onDone(earlyDone)
    auth.onError(earlyError)

    auth.complete(result)
    auth.complete({ ...result, callbackValue: { ok: false } })
    auth.reject(error)
    auth.reject(new Error('duplicate'))
    auth.onDone(lateDone)
    auth.onError(lateError)

    expect(earlyDone).toHaveBeenCalledExactlyOnceWith(result)
    expect(lateDone).toHaveBeenCalledExactlyOnceWith(result)
    expect(earlyError).toHaveBeenCalledExactlyOnceWith(error)
    expect(lateError).toHaveBeenCalledExactlyOnceWith(error)
  })

  it('opens a page, waits for callback data, normalizes storage, and closes the page', async () => {
    mocks.isTauri.mockReturnValue(true)
    let reads = 0
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'plugin:utils|webview_open_page') {
        return { label: 'delta-auth-1', url: 'https://auth.test/login' }
      }
      if (command === 'plugin:utils|webview_auth_data') {
        reads += 1
        return {
          cookies: [],
          frames: [],
          inaccessibleFrames: [],
          label: 'delta-auth-1',
          storage:
            reads === 1
              ? snapshot()
              : snapshot({
                  collectedAt: 2,
                  cookie: 'sid=1',
                  href: 'https://auth.test/callback',
                  localStorage: storage({ token: 'abc' }),
                  sessionStorage: storage({ nonce: 'xyz' }),
                  title: 'Done',
                  value: { ok: true },
                }),
          url: 'https://auth.test/login',
        }
      }
      if (command === 'plugin:utils|webview_close_page') return undefined
      throw new Error(`unexpected command: ${command}`)
    })

    const { PageWebviewAuth } = await import('./webviewAuth')
    const auth = new PageWebviewAuth<{ ok: boolean }>(
      'https://auth.test/login',
      { css: '', js: 'callback({ ok: true })' },
      { pollInterval: 0, title: 'Login' },
    )
    const onDone = vi.fn()
    auth.onDone(onDone)

    const result = await auth.mount()

    expect(result).toEqual({
      callbackValue: { ok: true },
      cookie: 'sid=1',
      href: 'https://auth.test/callback',
      localStorage: { token: 'abc' },
      sessionStorage: { nonce: 'xyz' },
      title: 'Done',
    })
    expect(onDone).toHaveBeenCalledWith(result)
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:utils|webview_open_page', {
      options: expect.objectContaining({
        allFrames: true,
        callbackName: 'authCallback',
        title: 'Login',
        url: 'https://auth.test/login',
      }),
    })
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:utils|webview_close_page', {
      label: 'delta-auth-1',
    })
  })

  it('uses the page snapshot when callback storage is incomplete and tolerates close failure', async () => {
    mocks.isTauri.mockReturnValue(true)
    const closeError = new Error('native close failed')
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'plugin:utils|webview_open_page') {
        return { label: 'delta-auth-fallback', url: 'https://auth.test/login' }
      }
      if (command === 'plugin:utils|webview_auth_data') {
        return {
          cookies: [],
          frames: [],
          inaccessibleFrames: [],
          label: 'delta-auth-fallback',
          storage: snapshot({
            collectedAt: 2,
            cookie: '',
            href: '',
            localStorage: [],
            sessionStorage: [],
            title: '',
            value: 'token',
          }),
          url: 'https://auth.test/login',
        }
      }
      if (command === 'plugin:utils|webview_close_page') throw closeError
      throw new Error(`unexpected command: ${command}`)
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const { PageWebviewAuth } = await import('./webviewAuth')
    const auth = new PageWebviewAuth(
      'https://auth.test/login',
      { css: '', js: '' },
      { allFrames: false, pollInterval: 0 },
    )

    await expect(auth.mount()).resolves.toEqual({
      callbackValue: 'token',
      cookie: 'fallback=1',
      href: 'https://auth.test/login',
      localStorage: { fallbackLocal: '1' },
      sessionStorage: { fallbackSession: '1' },
      title: 'Login',
    })
    expect(warn).toHaveBeenCalledWith(
      '[webview auth] failed to close auth page',
      'delta-auth-fallback',
      closeError,
    )
  })

  it('rejects and emits an error when a native auth page is cancelled while polling', async () => {
    mocks.isTauri.mockReturnValue(true)
    let resolveRead: ((value: unknown) => void) | undefined
    const read = new Promise<unknown>(resolve => {
      resolveRead = resolve
    })
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'plugin:utils|webview_open_page') {
        return { label: 'delta-auth-cancelled', url: 'https://auth.test/login' }
      }
      if (command === 'plugin:utils|webview_auth_data') return read
      if (command === 'plugin:utils|webview_close_page') return undefined
      throw new Error(`unexpected command: ${command}`)
    })

    const { PageWebviewAuth } = await import('./webviewAuth')
    const auth = new PageWebviewAuth(
      'https://auth.test/login',
      { css: '', js: '' },
      { pollInterval: 0 },
    )
    const onError = vi.fn()
    auth.onError(onError)
    const pending = auth.mount()
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('plugin:utils|webview_auth_data', {
        label: 'delta-auth-cancelled',
      }),
    )

    await auth.unmount()
    resolveRead?.({
      cookies: [],
      frames: [],
      inaccessibleFrames: [],
      label: 'delta-auth-cancelled',
      storage: snapshot(),
      url: 'https://auth.test/login',
    })

    await expect(pending).rejects.toThrow('webview auth page was closed')
    expect(onError).toHaveBeenCalledOnce()
    const lateError = vi.fn()
    auth.onError(lateError)
    expect(lateError).toHaveBeenCalledExactlyOnceWith(onError.mock.calls[0][0])
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:utils|webview_close_page', {
      label: 'delta-auth-cancelled',
    })
  })

  it('uses a popup and postMessage callback in a normal browser', async () => {
    let messageListener: ((event: MessageEvent) => void) | undefined
    const popup = { close: vi.fn(), closed: false }
    const browserWindow = {
      $api: {},
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
        if (type === 'message') messageListener = listener
      }),
      open: vi.fn(() => popup),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow })

    const { PageWebviewAuth } = await import('./webviewAuth')
    const auth = new PageWebviewAuth<{ ok: boolean }>(
      'https://auth.test/login',
      { css: '', js: '' },
      { pollInterval: 1, title: 'Login' },
    )
    const result = auth.mount()
    await vi.waitFor(() => expect(messageListener).toBeTypeOf('function'))
    messageListener?.({ data: null, source: {} } as MessageEvent)
    messageListener?.({ data: null, source: popup } as unknown as MessageEvent)
    messageListener?.({ data: { type: 'unrelated' }, source: popup } as unknown as MessageEvent)
    messageListener?.({
      data: { type: 'delta-comic:auth-callback', value: { ok: true } },
      source: popup,
    } as unknown as MessageEvent)

    await expect(result).resolves.toMatchObject({
      callbackValue: { ok: true },
      href: 'https://auth.test/login',
      title: 'Login',
    })
    expect(popup.close).toHaveBeenCalledOnce()
    expect(browserWindow.removeEventListener).toHaveBeenCalledWith('message', messageListener)
  })

  it('rejects when the browser blocks the popup and reports the same error to subscribers', async () => {
    const browserWindow = {
      $api: {},
      addEventListener: vi.fn(),
      open: vi.fn(() => null),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow })

    const { PageWebviewAuth } = await import('./webviewAuth')
    const auth = new PageWebviewAuth('https://auth.test/login', { css: '', js: '' })
    const onError = vi.fn()
    auth.onError(onError)

    await expect(auth.mount()).rejects.toThrow('browser blocked the authentication popup')
    expect(onError).toHaveBeenCalledOnce()
    expect(browserWindow.open).toHaveBeenCalledWith(
      'https://auth.test/login',
      'Delta Comic 登录',
      'width=560,height=760,noopener=no,popup=yes',
    )
  })

  it('rejects and removes listeners when the user closes the browser popup', async () => {
    vi.useFakeTimers()
    let messageListener: ((event: MessageEvent) => void) | undefined
    const popup = { close: vi.fn(), closed: false }
    const browserWindow = {
      $api: {},
      addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => {
        messageListener = listener
      }),
      open: vi.fn(() => popup),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow })

    const { PageWebviewAuth } = await import('./webviewAuth')
    const auth = new PageWebviewAuth(
      'https://auth.test/login',
      { css: '', js: '' },
      { pollInterval: 25 },
    )
    const pending = auth.mount()
    await vi.waitFor(() => expect(messageListener).toBeTypeOf('function'))
    popup.closed = true
    const rejection = expect(pending).rejects.toThrow('authentication popup closed before callback')
    await vi.advanceTimersByTimeAsync(25)

    await rejection
    expect(browserWindow.removeEventListener).toHaveBeenCalledWith('message', messageListener)
  })

  it('injects code into a same-origin iframe and resolves when authCallback is called', async () => {
    class FakeStorage {
      private readonly entries: [string, string][]

      constructor(data: Record<string, string>) {
        this.entries = Object.entries(data)
      }

      public get length() {
        return this.entries.length
      }

      public key(index: number) {
        return this.entries[index]?.[0] ?? null
      }

      public getItem(key: string) {
        return this.entries.find(entry => entry[0] === key)?.[1] ?? null
      }
    }

    const head = { append: vi.fn() }
    const frameDocument = {
      cookie: 'sid=1',
      createElement: vi.fn((_tag?: string) => ({ setAttribute: vi.fn(), textContent: '' })),
      documentElement: { append: vi.fn() },
      head,
      title: 'Iframe Login',
    }
    const frameWindow = {
      callback: undefined as ((result: unknown) => unknown) | undefined,
      localStorage: new FakeStorage({ token: 'abc' }),
      location: { href: 'https://auth.test/iframe' },
      sessionStorage: new FakeStorage({ state: 'ready' }),
    } as unknown as Window & {
      callback?: (result: unknown) => unknown
      eval: (code: string) => unknown
    }
    frameWindow.eval = vi.fn((code: string) => {
      const run = new Function('authCallback', 'callback', 'window', code)
      return run(frameWindow.authCallback, frameWindow.callback, frameWindow)
    })

    let loadListener: (() => void) | undefined
    const iframe = {
      addEventListener: vi.fn((type: string, listener: () => void) => {
        if (type === 'load') loadListener = listener
      }),
      contentDocument: frameDocument,
      contentWindow: frameWindow,
      remove: vi.fn(),
      src: '',
      style: {},
    }
    const parentElement = { append: vi.fn(() => loadListener?.()) }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: parentElement,
        createElement: vi.fn((tag: string) => {
          if (tag === 'iframe') return iframe
          return frameDocument.createElement(tag)
        }),
      },
    })

    const { IframeWebviewAuth } = await import('./webviewAuth')
    const auth = new IframeWebviewAuth<{ ok: boolean }>('https://auth.test/iframe', {
      css: 'body { color: red; }',
      js: 'authCallback({ ok: true })',
    })

    const result = await auth.mount(parentElement as unknown as Element)

    expect(result).toEqual({
      callbackValue: { ok: true },
      cookie: 'sid=1',
      href: 'https://auth.test/iframe',
      localStorage: { token: 'abc' },
      sessionStorage: { state: 'ready' },
      title: 'Iframe Login',
    })
    expect(parentElement.append).toHaveBeenCalledWith(iframe)
    expect(head.append).toHaveBeenCalled()
    expect(iframe.remove).toHaveBeenCalled()
  })

  it('requires an iframe parent and reuses the active authorization attempt', async () => {
    let loadListener: (() => void) | undefined
    const emptyStorage = {
      get length() {
        return 0
      },
      getItem: vi.fn(),
      key: vi.fn(),
    }
    const frameDocument = {
      cookie: '',
      documentElement: { append: vi.fn() },
      head: null,
      title: '',
    }
    const frameWindow = {
      authCallback: undefined as ((value: unknown) => unknown) | undefined,
      callback: undefined,
      localStorage: emptyStorage,
      location: { href: 'https://auth.test/iframe' },
      sessionStorage: emptyStorage,
    }
    const iframe = {
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        loadListener = listener
      }),
      contentDocument: frameDocument,
      contentWindow: frameWindow,
      remove: vi.fn(),
      src: '',
      style: {},
    }
    const parentElement = { append: vi.fn(() => loadListener?.()) }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { body: null, createElement: vi.fn(() => iframe) },
    })

    const { IframeWebviewAuth } = await import('./webviewAuth')
    const missingParent = new IframeWebviewAuth('https://auth.test/iframe', { css: '', js: '' })
    await expect(missingParent.mount()).rejects.toThrow('parentElement is required')

    const auth = new IframeWebviewAuth('https://auth.test/iframe', { css: '', js: '' })
    const first = auth.mount(parentElement as unknown as Element)
    const second = auth.mount(parentElement as unknown as Element)
    frameWindow.authCallback?.({ ok: true })

    expect(parentElement.append).toHaveBeenCalledOnce()
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ callbackValue: { ok: true } }),
      expect.objectContaining({ callbackValue: { ok: true } }),
    ])
    expect(iframe.remove).toHaveBeenCalledOnce()
  })

  it('rejects inaccessible cross-origin iframe pages and replays the wrapped error', async () => {
    let loadListener: (() => void) | undefined
    const iframe = {
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        loadListener = listener
      }),
      contentDocument: null,
      contentWindow: null,
      remove: vi.fn(),
      src: '',
      style: {},
    }
    const parentElement = { append: vi.fn(() => loadListener?.()) }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { body: parentElement, createElement: vi.fn(() => iframe) },
    })

    const { IframeWebviewAuth } = await import('./webviewAuth')
    const auth = new IframeWebviewAuth('https://external.test/login', { css: '', js: '' })
    const onError = vi.fn()
    auth.onError(onError)

    await expect(auth.mount(parentElement as unknown as Element)).rejects.toThrow(
      'IframeWebviewAuth only supports same-origin iframe pages',
    )
    expect(iframe.remove).toHaveBeenCalledOnce()
    const lateError = vi.fn()
    auth.onError(lateError)
    expect(lateError).toHaveBeenCalledExactlyOnceWith(onError.mock.calls[0][0])
  })

  it('falls back safely when iframe metadata or Web Storage cannot be read', async () => {
    let loadListener: (() => void) | undefined
    const documentElement = { append: vi.fn() }
    const frameDocument = {
      cookie: '',
      createElement: vi.fn(() => ({ setAttribute: vi.fn(), textContent: '' })),
      documentElement,
      head: null,
      title: '',
    }
    const sessionStorage = {
      get length() {
        return 2
      },
      getItem: vi.fn(() => null),
      key: vi.fn((index: number) => (index === 0 ? null : 'empty')),
    }
    const preservedCallback = vi.fn()
    const frameWindow = {
      authCallback: undefined as ((value: unknown) => unknown) | undefined,
      callback: preservedCallback,
      document: frameDocument,
      eval: vi.fn(),
      get localStorage(): Storage {
        throw 'storage denied'
      },
      location: { href: 'https://auth.test/iframe' },
      sessionStorage,
    }
    const iframe = {
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        loadListener = listener
      }),
      contentDocument: null,
      contentWindow: frameWindow,
      remove: vi.fn(),
      src: '',
      style: {},
    }
    const parentElement = { append: vi.fn(() => loadListener?.()) }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { body: parentElement, createElement: vi.fn(() => iframe) },
    })

    const { IframeWebviewAuth } = await import('./webviewAuth')
    const auth = new IframeWebviewAuth('https://auth.test/iframe', {
      css: 'body { display: block; }',
      js: '',
    })
    const pending = auth.mount(parentElement as unknown as Element)
    const callbackValue = { ok: true }
    frameWindow.authCallback?.(callbackValue)

    await expect(pending).resolves.toEqual({
      callbackValue,
      cookie: '',
      href: 'https://auth.test/iframe',
      localStorage: {},
      sessionStorage: { empty: '' },
      title: '',
    })
    expect(frameWindow.callback).toBe(preservedCallback)
    expect(frameWindow.eval).not.toHaveBeenCalled()
    expect(documentElement.append).toHaveBeenCalledOnce()
  })

  it('normalizes non-Error iframe evaluation failures and removes the iframe', async () => {
    let loadListener: (() => void) | undefined
    const frameDocument = {
      cookie: '',
      createElement: vi.fn(),
      documentElement: { append: vi.fn() },
      head: null,
      title: '',
    }
    const frameWindow = {
      callback: undefined,
      document: frameDocument,
      eval: vi.fn(() => {
        throw undefined
      }),
    }
    const iframe = {
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        loadListener = listener
      }),
      contentDocument: frameDocument,
      contentWindow: frameWindow,
      remove: vi.fn(),
      src: '',
      style: {},
    }
    const parentElement = { append: vi.fn(() => loadListener?.()) }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { body: parentElement, createElement: vi.fn(() => iframe) },
    })

    const { IframeWebviewAuth } = await import('./webviewAuth')
    const auth = new IframeWebviewAuth('https://auth.test/iframe', {
      css: '',
      js: 'throw new Error()',
    })

    await expect(auth.mount(parentElement as unknown as Element)).rejects.toThrow('unknown error')
    expect(iframe.remove).toHaveBeenCalledOnce()
  })
})