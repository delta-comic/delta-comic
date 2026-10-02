import { logger } from '@delta-comic/logger'
import { isTauri } from '@tauri-apps/api/core'

const webviewAuthLogger = logger.scoped('utils:webview-auth')

const CALLBACK_NAME = 'authCallback'
const DEFAULT_POLL_INTERVAL = 300

const call = async <T>(command: string, args: Record<string, unknown> = {}) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<T>(`plugin:utils|${command}`, args)
}

export interface InjectCode {
  js: string
  css: string
}

export interface OpenWebviewPageOptions extends Partial<InjectCode> {
  url: string
  label?: string
  title?: string
  callbackName?: string
  allFrames?: boolean
  visible?: boolean
  width?: number
  height?: number
  userAgent?: string
  incognito?: boolean
  devtools?: boolean
}

export interface OpenedWebviewPage {
  label: string
  url: string
}

export interface InjectWebviewCodeOptions extends Partial<InjectCode> {
  label?: string
  callbackName?: string
}

export interface StorageEntry {
  key: string
  value: string
}

export interface AuthCallbackSnapshot<T = unknown> {
  value: T
  href: string
  title: string
  cookie: string
  localStorage: StorageEntry[]
  sessionStorage: StorageEntry[]
  collectedAt: number
}

export interface WebStorageSnapshot<T = unknown> {
  frameId: string
  reason: string
  top: boolean
  href: string
  origin: string
  title: string
  cookie: string
  localStorage: StorageEntry[]
  sessionStorage: StorageEntry[]
  callback?: AuthCallbackSnapshot<T> | null
  errors: string[]
  collectedAt: number
}

export interface InaccessibleFrame {
  index: number
  src: string
  error: string
}

export interface WebviewCookie {
  name: string
  value: string
  domain?: string | null
  path?: string | null
  secure?: boolean | null
  httpOnly?: boolean | null
  sameSite?: string | null
  expires?: string | null
  source: string
}

export interface WebviewAuthData<T = unknown> {
  label: string
  url: string
  cookies: WebviewCookie[]
  storage: WebStorageSnapshot<T>
  frames: WebStorageSnapshot<T>[]
  inaccessibleFrames: InaccessibleFrame[]
}

export interface WebviewAuthResult<T = unknown> {
  callbackValue: T
  cookie: string
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  href: string
  title: string
}

export interface PageWebviewAuthOptions extends Pick<
  OpenWebviewPageOptions,
  | 'allFrames'
  | 'devtools'
  | 'height'
  | 'incognito'
  | 'label'
  | 'title'
  | 'userAgent'
  | 'visible'
  | 'width'
> {
  pollInterval?: number
}

export const openWebviewPage = (options: OpenWebviewPageOptions) =>
  call<OpenedWebviewPage>('webview_open_page', { options })

export const injectWebviewCode = (options: InjectWebviewCodeOptions) =>
  call<void>('webview_inject_code', { options })

export const closeCurrentWebviewPage = () => call<void>('webview_close_current_page')

export const closeWebviewPage = (label: string) => call<void>('webview_close_page', { label })

export const getCurrentWebviewAuthData = <T = unknown>() =>
  call<WebviewAuthData<T>>('webview_auth_data_current')

export const getWebviewAuthData = <T = unknown>(label: string) =>
  call<WebviewAuthData<T>>('webview_auth_data', { label })

export const getAllWebviewAuthData = <T = unknown>() =>
  call<WebviewAuthData<T>[]>('webview_auth_data_all')

export const getWebviewIframeAuthData = <T = unknown>(label: string, waitMs?: number) =>
  call<WebviewAuthData<T>>('webview_iframe_auth_data', { label, waitMs })

export const storageEntriesToRecord = (entries: StorageEntry[]) =>
  Object.fromEntries(entries.map(entry => [entry.key, entry.value]))

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const authCallbackToResult = <T>(
  callback: AuthCallbackSnapshot<T>,
  fallback?: WebStorageSnapshot<T>,
): WebviewAuthResult<T> => ({
  callbackValue: callback.value,
  cookie: callback.cookie || fallback?.cookie || '',
  href: callback.href || fallback?.href || '',
  localStorage: storageEntriesToRecord(
    callback.localStorage.length ? callback.localStorage : fallback?.localStorage || [],
  ),
  sessionStorage: storageEntriesToRecord(
    callback.sessionStorage.length ? callback.sessionStorage : fallback?.sessionStorage || [],
  ),
  title: callback.title || fallback?.title || '',
})

const readStorage = (getStorage: () => Storage | undefined): StorageEntry[] => {
  try {
    const storage = getStorage()
    if (!storage) return []
    const entries: StorageEntry[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === null) continue
      entries.push({ key, value: storage.getItem(key) || '' })
    }
    return entries
  } catch {
    return []
  }
}

const normalizeError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error || 'unknown error'))

export abstract class WebviewAuth<T = unknown> {
  protected injectCode: { js: string; css: string }
  private doneCallbacks = new Set<(result: WebviewAuthResult<T>) => void>()
  private errorCallbacks = new Set<(error: unknown) => void>()
  private result: WebviewAuthResult<T> | undefined
  private error: unknown

  constructor(
    public url: string,
    injectCode: InjectCode,
  ) {
    this.injectCode = { ...injectCode }
  }

  public abstract mount(parentElement?: Element): Promise<WebviewAuthResult<T>>
  public abstract unmount(): Promise<void>

  public onDone(cb: (result: WebviewAuthResult<T>) => void): void {
    this.doneCallbacks.add(cb)
    if (this.result) cb(this.result)
  }

  public onError(cb: (error: unknown) => void): void {
    this.errorCallbacks.add(cb)
    if (this.error) cb(this.error)
  }

  protected done(result: WebviewAuthResult<T>) {
    if (this.result) return
    this.result = result
    for (const cb of this.doneCallbacks) cb(result)
  }

  protected fail(error: unknown) {
    if (this.error) return
    this.error = error
    for (const cb of this.errorCallbacks) cb(error)
  }

  protected reset() {
    this.result = undefined
    this.error = undefined
  }
}

export class PageWebviewAuth<T = unknown> extends WebviewAuth<T> {
  private page: OpenedWebviewPage | undefined
  private popup: Window | null = null
  private running: Promise<WebviewAuthResult<T>> | undefined
  private closed = false

  constructor(
    url: string,
    injectCode: InjectCode,
    private options: PageWebviewAuthOptions = {},
  ) {
    super(url, injectCode)
  }

  public async mount() {
    if (this.running) return this.running
    this.reset()
    this.closed = false
    this.running = this.openAndWait()
    return this.running
  }

  public async unmount() {
    this.closed = true
    if (this.popup) {
      this.popup.close()
      this.popup = null
    }
    if (!this.page) return
    const page = this.page
    this.page = undefined
    await closeWebviewPage(page.label)
  }

  private async openAndWait() {
    try {
      if (!isTauri()) {
        return await this.openBrowserPopup()
      }
      this.page = await openWebviewPage({
        allFrames: this.options.allFrames ?? true,
        callbackName: CALLBACK_NAME,
        css: this.injectCode.css,
        devtools: this.options.devtools,
        height: this.options.height,
        incognito: this.options.incognito,
        js: this.injectCode.js,
        label: this.options.label,
        title: this.options.title,
        url: this.url,
        userAgent: this.options.userAgent,
        visible: this.options.visible,
        width: this.options.width,
      })

      for (;;) {
        if (this.closed || !this.page) throw new Error('webview auth page was closed')

        const data = await getWebviewAuthData<T>(this.page.label)
        const callback = data.storage.callback
        if (callback) {
          const result = authCallbackToResult(callback, data.storage)
          this.done(result)
          const label = this.page.label
          await this.unmount().catch((error: unknown) => {
            webviewAuthLogger.warn('failed to close auth page', { label }, error)
          })
          return result
        }

        await wait(this.options.pollInterval ?? DEFAULT_POLL_INTERVAL)
      }
    } catch (error) {
      this.fail(error)
      await this.unmount().catch(() => undefined)
      throw error
    } finally {
      this.running = undefined
    }
  }

  private async openBrowserPopup(): Promise<WebviewAuthResult<T>> {
    const features = [
      `width=${this.options.width ?? 560}`,
      `height=${this.options.height ?? 760}`,
      'noopener=no',
      'popup=yes',
    ].join(',')
    this.popup = window.open(this.url, this.options.title ?? 'Delta Comic 登录', features)
    if (!this.popup) throw new Error('browser blocked the authentication popup')

    return await new Promise<WebviewAuthResult<T>>((resolve, reject) => {
      const cleanup = () => {
        clearInterval(closedPoll)
        window.removeEventListener('message', onMessage)
        this.popup = null
      }
      const onMessage = (event: MessageEvent) => {
        if (event.source !== this.popup) return
        const data = event.data as { type?: string; value?: T }
        if (!data || data.type !== 'delta-comic:auth-callback') return
        const result: WebviewAuthResult<T> = {
          callbackValue: data.value as T,
          cookie: '',
          href: this.url,
          localStorage: {},
          sessionStorage: {},
          title: this.options.title ?? '',
        }
        this.popup?.close()
        cleanup()
        this.done(result)
        resolve(result)
      }
      const closedPoll = setInterval(() => {
        if (!this.popup?.closed) return
        cleanup()
        reject(
          new Error(
            'authentication popup closed before callback; the callback page must postMessage ' +
              '{ type: "delta-comic:auth-callback", value } to window.opener',
          ),
        )
      }, this.options.pollInterval ?? DEFAULT_POLL_INTERVAL)
      window.addEventListener('message', onMessage)
    })
  }
}

export class IframeWebviewAuth<T = unknown> extends WebviewAuth<T> {
  private iframe: HTMLIFrameElement | undefined
  private running: Promise<WebviewAuthResult<T>> | undefined
  private resolveRunning: ((result: WebviewAuthResult<T>) => void) | undefined
  private rejectRunning: ((error: unknown) => void) | undefined

  constructor(url: string, injectCode: InjectCode) {
    super(url, injectCode)
  }

  public async mount(parentElement: Element = document.body) {
    if (this.running) return this.running
    if (!parentElement) throw new Error('parentElement is required')

    this.reset()
    this.iframe = document.createElement('iframe')
    this.iframe.src = this.url
    this.iframe.style.border = '0'
    this.iframe.style.width = '100%'
    this.iframe.style.height = '100%'

    const running = new Promise<WebviewAuthResult<T>>((resolve, reject) => {
      this.resolveRunning = resolve
      this.rejectRunning = reject
      this.iframe?.addEventListener('load', () => this.injectIntoIframe(), { once: true })
    })
    this.running = running
    parentElement.append(this.iframe)
    return running
  }

  public async unmount() {
    this.iframe?.remove()
    this.iframe = undefined
    this.resolveRunning = undefined
    this.rejectRunning = undefined
    this.running = undefined
  }

  private injectIntoIframe() {
    try {
      const iframeWindow = this.iframe?.contentWindow
      const iframeDocument = this.iframe?.contentDocument || iframeWindow?.document
      if (!iframeWindow || !iframeDocument) {
        throw new Error('missing iframe window or document')
      }

      this.injectStyle(iframeDocument)
      Object.defineProperty(iframeWindow, CALLBACK_NAME, {
        configurable: true,
        enumerable: false,
        value: (value: T) => {
          const result = this.collectIframeResult(iframeWindow, iframeDocument, value)
          this.done(result)
          this.resolveRunning?.(result)
          void this.unmount()
          return value
        },
        writable: true,
      })
      if (typeof iframeWindow.callback !== 'function') {
        iframeWindow.callback = iframeWindow[CALLBACK_NAME]
      }
      if (this.injectCode.js) {
        const evaluate = (iframeWindow as Window & { eval: (code: string) => unknown }).eval
        evaluate.call(iframeWindow, this.injectCode.js)
      }
    } catch (error) {
      const reason = normalizeError(error)
      const wrapped = new Error(
        `failed to inject auth code into iframe: ${reason.message}. ` +
          'IframeWebviewAuth only supports same-origin iframe pages; use PageWebviewAuth for external auth pages.',
      )
      this.fail(wrapped)
      const reject = this.rejectRunning
      void this.unmount()
      reject?.(wrapped)
    }
  }

  private injectStyle(iframeDocument: Document) {
    if (!this.injectCode.css) return
    const style = iframeDocument.createElement('style')
    style.setAttribute('data-delta-comic-auth', 'true')
    style.textContent = this.injectCode.css
    const parent = iframeDocument.head || iframeDocument.documentElement
    parent.append(style)
  }

  private collectIframeResult(
    iframeWindow: Window,
    iframeDocument: Document,
    value: T,
  ): WebviewAuthResult<T> {
    return {
      callbackValue: value,
      cookie: iframeDocument.cookie || '',
      href: iframeWindow.location.href,
      localStorage: storageEntriesToRecord(readStorage(() => iframeWindow.localStorage)),
      sessionStorage: storageEntriesToRecord(readStorage(() => iframeWindow.sessionStorage)),
      title: iframeDocument.title || '',
    }
  }
}

declare global {
  interface Window {
    authCallback?: (result: unknown) => unknown
    callback?: (result: unknown) => unknown
  }
}