import { isDate, isNumber, merge } from 'es-toolkit'

import {
  createTauRPCProxy,
  type ClearCookiesConfig,
  type ClientConfig,
  type CookieEntry,
  type DeleteCookieConfig,
  type GetAllCookiesConfig,
  type GetAllDomainCookiesConfig,
  type GetCookieConfig,
  type SetCookieConfig,
} from './bindings'

import { createCORSFetch } from './fetch'
import type { CORSFetchConfig, CORSFetchInit } from './fetch'
import { createCORSXMLHttpRequestConstructor } from './xhr'

let commands: ReturnType<typeof createTauRPCProxy>['http'] | undefined

function getCommands() {
  return (commands ??= createTauRPCProxy().http)
}

declare global {
  interface Window {
    CORSFetch?: CORSFetch
    fetchNative: typeof fetch
    fetchCORS: (
      input: Parameters<typeof fetch>[0],
      init: CORSFetchInit,
    ) => ReturnType<CORSFetch['fetch']>
    fetch: CORSFetch['fetch']
    XMLHttpRequestNative: typeof XMLHttpRequest
  }
}

export interface CookieOptions {
  domain?: string
  path?: string
  expires?: Date | string
  maxAge?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T

export const GLOBAL_INSTANCE_KEY = ''

export class CORSFetch {
  /**
   * @param config 如果`config.request.instanceKey`是`""`或`undefined`，则默认注入全局，并使用全局instance
   */
  public static async init(config?: DeepPartial<CORSFetchConfig>): Promise<CORSFetch> {
    const cors = new CORSFetch(config)
    const instanceKey = cors.config.request.instanceKey

    console.debug('Create cors instance.', instanceKey)
    const prepareConfig: ClientConfig = cors.config.request
    await getCommands().prepare_requester(prepareConfig)

    if (instanceKey == GLOBAL_INSTANCE_KEY && !window.CORSFetch) {
      const corsFetch = cors.fetch.bind(cors)

      window.CORSFetch = cors
      window.fetchNative = window.fetch.bind(window)
      window.fetch = corsFetch
      window.fetchCORS = (input, init) => cors.fetch(input, init, true)
      window.XMLHttpRequestNative = window.XMLHttpRequest
      window.XMLHttpRequest = cors.XHR
    }
    console.debug('Create cors instance done.', instanceKey)
    return cors
  }

  protected constructor(config?: DeepPartial<CORSFetchConfig>) {
    void this.setConfig(config ?? {})
  }

  private _config: CORSFetchConfig = {
    include: [],
    exclude: [],
    request: {
      proxy: null,
      connectTimeout: null,
      maxRedirections: null,
      userAgent: navigator.userAgent,
      danger: { acceptInvalidCerts: false, acceptInvalidHostnames: false },
      instanceKey: GLOBAL_INSTANCE_KEY,
    },
  }

  private _fetch = createCORSFetch(() => this._config)

  public readonly XHR: typeof XMLHttpRequest = createCORSXMLHttpRequestConstructor(
    this.fetch.bind(this),
  )

  public get config(): CORSFetchConfig {
    return this._config
  }

  public setConfig(newConfig: DeepPartial<CORSFetchConfig>): Promise<void> {
    merge(this._config, newConfig)
    return getCommands().prepare_requester(this._config.request).catch(() => {})
  }

  public fetch(
    input: Parameters<typeof fetch>[0],
    init?: CORSFetchInit,
    force = false,
  ): Promise<Response> {
    return this._fetch(input, init, force)
  }

  public setCookie(url: string | URL, content: string): Promise<void> {
    const config: SetCookieConfig = {
      url: String(url),
      content,
      instanceKey: this.config.request.instanceKey,
    }
    return getCommands().set_cookie(config).then(() => undefined)
  }

  public getCookie(url: string | URL, name: string): Promise<string | null> {
    const config: GetCookieConfig = {
      url: String(url),
      name,
      instanceKey: this.config.request.instanceKey,
    }
    return getCommands().get_cookie(config)
  }

  public getAllDomainCookies(url: string | URL): Promise<CookieEntry[]> {
    const config: GetAllDomainCookiesConfig = {
      url: String(url),
      instanceKey: this.config.request.instanceKey,
    }
    return getCommands().get_all_domain_cookies(config)
  }

  public getAllCookies(): Promise<CookieEntry[]> {
    const config: GetAllCookiesConfig = { instanceKey: this.config.request.instanceKey }
    return getCommands().get_all_cookies(config)
  }

  public deleteCookie(url: string | URL, path = '/', name: string): Promise<boolean> {
    const config: DeleteCookieConfig = {
      url: url.toString(),
      name,
      path,
      instanceKey: this.config.request.instanceKey,
    }
    return getCommands().delete_cookie(config)
  }

  public clearCookie(): Promise<void> {
    const config: ClearCookiesConfig = { instanceKey: this.config.request.instanceKey }
    return getCommands().clear_cookie(config).then(() => undefined)
  }

  public setCookieByParts(
    url: string | URL,
    name: string,
    value: string,
    options: CookieOptions = {},
  ): Promise<void> {
    const segments = [`${name}=${value}`]

    if (options.domain) segments.push(`Domain=${options.domain}`)
    if (options.path) segments.push(`Path=${options.path}`)
    if (options.expires) {
      const expires = isDate(options.expires)
        ? options.expires.toUTCString()
        : new Date(options.expires).toUTCString()
      segments.push(`Expires=${expires}`)
    }
    if (isNumber(options.maxAge)) segments.push(`Max-Age=${options.maxAge}`)
    if (options.secure) segments.push('Secure')
    if (options.httpOnly) segments.push('HttpOnly')
    if (options.sameSite) segments.push(`SameSite=${options.sameSite}`)

    return this.setCookie(url, segments.join('; '))
  }
}
