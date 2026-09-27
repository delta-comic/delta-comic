import { logger } from '@delta-comic/logger'

import type { ApiResponse } from './types'

const apiLogger = logger.scoped('server-admin:api')

export interface AdminApiClientOptions {
  baseUrl: string
  fetcher?: typeof fetch
  getToken?: () => string
  timeout?: number
}

export interface AdminRequestOptions {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  signal?: AbortSignal
}

export class AdminApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isApiResponse = <T>(value: unknown): value is ApiResponse<T> => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false
  if (value.ok) return 'data' in value
  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

export class AdminApiClient {
  private readonly fetcher: typeof fetch
  private readonly timeout: number

  constructor(private readonly options: AdminApiClientOptions) {
    this.fetcher = (options.fetcher ?? globalThis.fetch).bind(globalThis)
    this.timeout = options.timeout ?? 12_000
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { signal })
  }

  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { body, method: 'POST', signal })
  }

  patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { body, method: 'PATCH', signal })
  }

  put<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { body, method: 'PUT', signal })
  }

  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', signal })
  }

  async request<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const startedAt = Date.now()
    const controller = new AbortController()
    let timedOut = false
    const abortFromCaller = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeout)

    try {
      apiLogger.debug('admin API request started', { method, path })
      const headers = new Headers({ accept: 'application/json' })
      const token = this.options.getToken?.().trim()
      if (token) headers.set('authorization', `Bearer ${token}`)
      if (options.body !== undefined) headers.set('content-type', 'application/json')

      const response = await this.fetcher(this.resolve(path), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method,
        signal: controller.signal,
      })

      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        throw new AdminApiError(
          'ADMIN_INVALID_RESPONSE',
          `服务器返回了无法解析的响应（HTTP ${response.status}）`,
          response.status,
          error,
        )
      }

      if (!isApiResponse<T>(payload)) {
        throw new AdminApiError(
          'ADMIN_INVALID_ENVELOPE',
          '服务器响应不符合管理 API 契约',
          response.status,
          payload,
        )
      }
      if (!payload.ok) {
        throw new AdminApiError(
          payload.error.code,
          payload.error.message,
          response.status,
          payload.error.details,
        )
      }
      if (!response.ok) {
        throw new AdminApiError('ADMIN_HTTP_ERROR', `HTTP ${response.status}`, response.status)
      }
      apiLogger.debug('admin API request completed', {
        durationMs: Date.now() - startedAt,
        method,
        path,
        status: response.status,
      })
      return payload.data
    } catch (error) {
      if (error instanceof AdminApiError) {
        apiLogger.warn('admin API request rejected', {
          code: error.code,
          durationMs: Date.now() - startedAt,
          method,
          path,
          status: error.status,
        })
        throw error
      }
      if (timedOut) {
        apiLogger.warn('admin API request timed out', {
          durationMs: Date.now() - startedAt,
          method,
          path,
        })
        throw new AdminApiError('ADMIN_REQUEST_TIMEOUT', '请求超时，请检查服务器连接')
      }
      if (controller.signal.aborted) {
        apiLogger.debug('admin API request aborted', { method, path })
        throw new AdminApiError('ADMIN_REQUEST_ABORTED', '请求已取消', undefined, error)
      }
      apiLogger.error('admin API request failed', {
        durationMs: Date.now() - startedAt,
        error,
        method,
        path,
      })
      throw new AdminApiError(
        'ADMIN_REQUEST_FAILED',
        error instanceof Error ? error.message : '管理 API 请求失败',
        undefined,
        error,
      )
    } finally {
      clearTimeout(timeoutId)
      options.signal?.removeEventListener('abort', abortFromCaller)
    }
  }

  private resolve(path: string): string {
    const suffix = path.startsWith('/') ? path : `/${path}`
    return `${this.options.baseUrl.replace(/\/+$/, '')}${suffix}`
  }
}

export const readableApiError = (error: unknown): string =>
  error instanceof AdminApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error)