import { CLOUD_SCHEMA_VERSION } from '../constants'
import type { CloudHttpClient } from '../http'

import type {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshotRequest,
} from './types'

export class CloudSyncClient {
  constructor(
    private readonly http: CloudHttpClient,
    private readonly ensureAccessToken: () => Promise<string>,
  ) {}

  async snapshot(request: SyncSnapshotRequest): Promise<SyncPushResponse> {
    await this.ensureAccessToken()
    return await this.http.post('sync/snapshot', {
      ...request,
      schemaVersion: CLOUD_SCHEMA_VERSION,
    })
  }

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    await this.ensureAccessToken()
    return await this.http.post('sync/push', { ...request, schemaVersion: CLOUD_SCHEMA_VERSION })
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    await this.ensureAccessToken()
    return await this.http.post('sync/pull', {
      ...request,
      schemaVersion: request.schemaVersion ?? CLOUD_SCHEMA_VERSION,
    })
  }
}