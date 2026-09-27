import { createCloudClient, createSyncSnapshotRequest } from '@delta-comic/server'

import { DbCloudSessionStorage, DbCloudSyncStorage, getCloudTerminal } from './storage'
import { DbCloudSyncAdapter } from './syncAdapter'

export interface AppCloudRuntimeOptions {
  enabled: boolean
  serverUrl: string
}

export interface AppCloudRuntime {
  adapter: DbCloudSyncAdapter
  client: ReturnType<typeof createCloudClient>
  metadata: DbCloudSyncStorage
  sessionStorage: DbCloudSessionStorage
}

export const createAppCloudRuntime = (options: AppCloudRuntimeOptions): AppCloudRuntime => {
  const sessionStorage = new DbCloudSessionStorage()
  return {
    adapter: new DbCloudSyncAdapter(),
    client: createCloudClient({
      baseUrl: options.serverUrl,
      enabled: options.enabled,
      sessionStorage,
      terminal: getCloudTerminal,
    }),
    metadata: new DbCloudSyncStorage(),
    sessionStorage,
  }
}

export { createSyncSnapshotRequest }
export { DbCloudSessionStorage, DbCloudSyncAdapter, DbCloudSyncStorage, getCloudTerminal }