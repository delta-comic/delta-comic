import { treaty } from '@elysia/eden'

import { CloudAuthClient } from './auth'
import { OFFICIAL_SERVER_URL } from './constants'
import { CloudHttpClient } from './http'
import type { CloudHttpClientOptions } from './http'
import { MemoryCloudSessionStorage } from './storage'
import type { CloudSessionStorage } from './storage'
import { CloudSyncClient } from './sync/client'
import type { CloudHealthResponse, CloudTerminalProvider } from './types'

export interface CreateCloudClientOptions extends CloudHttpClientOptions {
  sessionStorage?: CloudSessionStorage
  terminal?: CloudTerminalProvider
  tokenRefreshLeeway?: number
}

export class DeltaComicCloudClient {
  readonly auth: CloudAuthClient
  readonly http: CloudHttpClient
  readonly sync: CloudSyncClient

  constructor(options: CreateCloudClientOptions = {}) {
    const sessionStorage = options.sessionStorage ?? new MemoryCloudSessionStorage()
    this.http = new CloudHttpClient({
      ...options,
      getAccessToken: async () => (await sessionStorage.getSession())?.tokens.accessToken,
    })
    this.auth = new CloudAuthClient(
      this.http,
      sessionStorage,
      options.terminal,
      options.tokenRefreshLeeway,
    )
    this.sync = new CloudSyncClient(this.http, () => this.auth.ensureAccessToken())
  }

  get enabled(): boolean {
    return this.http.enabled
  }

  async health(): Promise<CloudHealthResponse> {
    return await this.http.get('health', { auth: false })
  }
}

export const createCloudClient = (options: CreateCloudClientOptions = {}): DeltaComicCloudClient =>
  new DeltaComicCloudClient(options)

export type RawCloudServerClient = unknown

export const createRawCloudServerClient = (url = OFFICIAL_SERVER_URL): RawCloudServerClient =>
  treaty(url) as RawCloudServerClient

export const useCloudServer = createCloudClient