import ky, { HTTPError, TimeoutError } from 'ky'
import type { KyInstance, Options, RetryOptions } from 'ky'

import { CLOUD_API_PREFIX, DEFAULT_REQUEST_TIMEOUT } from './constants'
import {
  CloudApiError,
  CloudClientError,
  CloudConfigurationError,
  CloudDisabledError,
  toCloudClientError,
  unwrapApiResponse,
} from './errors'
import type { ApiResponse } from './types'

export interface CloudHttpClientOptions {
  baseUrl?: string
  enabled?: boolean
  fetcher?: typeof fetch
  getAccessToken?: () => Promise<string | undefined>
  retry?: RetryOptions | number
  timeout?: false | number
}

export interface CloudRequestOptions {
  auth?: boolean
  headers?: HeadersInit
  searchParams?: Options['searchParams']
  signal?: AbortSignal
}

const normalizePrefixUrl = (baseUrl: string | undefined): string => {
  const value = baseUrl?.trim().replace(/\/+$/, '')
  if (!value) throw new CloudConfigurationError('cloud server url is empty')
  try {
    const url = new URL(value)
    const normalized = url.toString().replace(/\/+$/, '')
    return normalized.endsWith(`/${CLOUD_API_PREFIX}`)
      ? `${normalized}/`
      : `${normalized}/${CLOUD_API_PREFIX}/`
  } catch (error) {
    throw new CloudConfigurationError('cloud server url is invalid', error)
  }
}

const normalizePath = (path: string): string => path.replace(/^\/+/, '')

const normalizeKyError = async (error: unknown): Promise<CloudClientError> => {
  if (error instanceof HTTPError) {
    try {
      const payload = (await error.response.clone().json()) as ApiResponse<unknown>
      if (payload && typeof payload === 'object' && 'ok' in payload) {
        try {
          unwrapApiResponse(payload, error.response.status)
        } catch (apiError) {
          return toCloudClientError(apiError)
        }
      }
    } catch {}
    return new CloudClientError('CLOUD_HTTP_ERROR', error.message, error.response.status)
  }
  if (error instanceof TimeoutError) return new CloudClientError('CLOUD_TIMEOUT', error.message)
  return toCloudClientError(error)
}

export class CloudHttpClient {
  private readonly client: KyInstance

  constructor(private readonly options: CloudHttpClientOptions) {
    this.client = ky.create({
      fetch: options.fetcher,
      baseUrl:
        options.enabled === false || !options.baseUrl
          ? undefined
          : normalizePrefixUrl(options.baseUrl),
      retry: options.retry ?? 0,
      timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT,
      throwHttpErrors: false,
    })
  }

  get enabled(): boolean {
    return this.options.enabled !== false
  }

  assertEnabled(): void {
    if (!this.enabled) throw new CloudDisabledError()
    normalizePrefixUrl(this.options.baseUrl)
  }

  async get<T>(path: string, options: CloudRequestOptions = {}): Promise<T> {
    return await this.request<T>('get', path, undefined, options)
  }

  async post<T>(path: string, json?: unknown, options: CloudRequestOptions = {}): Promise<T> {
    return await this.request<T>('post', path, json, options)
  }

  private async request<T>(
    method: 'get' | 'post',
    path: string,
    json: unknown,
    options: CloudRequestOptions,
  ): Promise<T> {
    this.assertEnabled()
    const headers = new Headers(options.headers)
    if (options.auth !== false) {
      const accessToken = await this.options.getAccessToken?.()
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    }
    try {
      const response = await this.client(normalizePath(path), {
        headers,
        json,
        method,
        searchParams: options.searchParams,
        signal: options.signal,
      })
      let payload: ApiResponse<T>
      try {
        payload = await response.json<ApiResponse<T>>()
      } catch (error) {
        if (!response.ok) {
          throw new CloudClientError(
            'CLOUD_HTTP_ERROR',
            `Request failed with status code ${response.status}`,
            response.status,
            error,
          )
        }
        throw error
      }
      return unwrapApiResponse(payload, response.status)
    } catch (error) {
      throw await normalizeKyError(error)
    }
  }
}

export const isCloudApiError = (error: unknown): error is CloudApiError =>
  error instanceof CloudApiError