import { logger } from '@delta-comic/logger'
import { useConfig } from '@delta-comic/plugin'
import {
  CloudClientError,
  CloudDisabledError,
  createSyncSnapshotRequest,
  type CloudLoginInput,
  type CloudRegisterInput,
  type CloudSession,
  type SyncPullRequest,
  type SyncPushOperation,
} from '@delta-comic/server'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { createAppCloudRuntime, type AppCloudRuntime } from '@/cloud'

const cloudLogger = logger.scoped('app:cloud')

type CloudStatus = 'idle' | 'loading' | 'syncing'

interface CloudCoreConfig {
  cloudEnabled?: boolean
  cloudServerUrl?: string
}

export const useCloudStore = defineStore('cloud', () => {
  const configStore = useConfig()
  const session = shallowRef<CloudSession | null>(null)
  const status = shallowRef<CloudStatus>('idle')
  const lastError = shallowRef<CloudClientError>()
  const lastSyncedAt = shallowRef<number>()
  const runtime = shallowRef<AppCloudRuntime>()
  const runtimeKey = shallowRef('')

  const coreConfig = computed(() => configStore.$loadApp().data.value as CloudCoreConfig)
  const isEnabled = computed(() => Boolean(coreConfig.value.cloudEnabled))
  const serverUrl = computed(() => (coreConfig.value.cloudServerUrl ?? '').trim())
  const isConfigured = computed(() => isEnabled.value && serverUrl.value.length > 0)

  const getRuntime = (): AppCloudRuntime => {
    if (!isConfigured.value) throw new CloudDisabledError()
    const key = `${isEnabled.value}:${serverUrl.value}`
    if (!runtime.value || runtimeKey.value !== key) {
      runtime.value = createAppCloudRuntime({
        enabled: isEnabled.value,
        serverUrl: serverUrl.value,
      })
      runtimeKey.value = key
      cloudLogger.info('cloud runtime configured')
    }
    return runtime.value
  }

  const run = async <T>(nextStatus: CloudStatus, handler: () => Promise<T>): Promise<T> => {
    cloudLogger.debug('cloud operation started', { status: nextStatus })
    status.value = nextStatus
    lastError.value = undefined
    try {
      return await handler()
    } catch (error) {
      lastError.value =
        error instanceof CloudClientError
          ? error
          : new CloudClientError(
              'CLOUD_APP_ERROR',
              error instanceof Error ? error.message : String(error),
            )
      cloudLogger.error('cloud operation failed', {
        code: lastError.value.code,
        status: nextStatus,
      })
      throw lastError.value
    } finally {
      status.value = 'idle'
      cloudLogger.debug('cloud operation finished', { status: nextStatus })
    }
  }

  const hydrate = async (): Promise<CloudSession | null> => {
    const currentRuntime =
      runtime.value ?? createAppCloudRuntime({ enabled: false, serverUrl: serverUrl.value })
    session.value = await currentRuntime.sessionStorage.getSession()
    cloudLogger.info('cloud session hydrated', { authenticated: Boolean(session.value) })
    return session.value
  }

  const login = async (input: CloudLoginInput): Promise<CloudSession> =>
    await run('loading', async () => {
      session.value = await getRuntime().client.auth.login(input)
      cloudLogger.info('cloud login completed')
      return session.value
    })

  const register = async (input: CloudRegisterInput): Promise<CloudSession> =>
    await run('loading', async () => {
      session.value = await getRuntime().client.auth.register(input)
      cloudLogger.info('cloud registration completed')
      return session.value
    })

  const logout = async (): Promise<void> =>
    await run('loading', async () => {
      if (isConfigured.value) await getRuntime().client.auth.logout()
      const currentRuntime =
        runtime.value ?? createAppCloudRuntime({ enabled: false, serverUrl: serverUrl.value })
      await currentRuntime.sessionStorage.clearSession()
      session.value = null
      cloudLogger.info('cloud logout completed')
    })

  const me = async () => await run('loading', async () => await getRuntime().client.auth.me())

  const pushSnapshot = async () =>
    await run('syncing', async () => {
      const currentRuntime = getRuntime()
      const collections = await currentRuntime.adapter.collectSnapshot()
      const result = await currentRuntime.client.sync.snapshot(
        createSyncSnapshotRequest(collections),
      )
      await currentRuntime.metadata.setCheckpoint(result.checkpoint.latestSeq)
      lastSyncedAt.value = Date.now()
      cloudLogger.info('cloud snapshot pushed', {
        checkpoint: result.checkpoint.latestSeq,
        collectionCount: Object.keys(collections).length,
      })
      return result
    })

  const push = async (operations: SyncPushOperation[]) =>
    await run('syncing', async () => {
      const currentRuntime = getRuntime()
      const result = await currentRuntime.client.sync.push({ operations, schemaVersion: 1 })
      await currentRuntime.metadata.setCheckpoint(result.checkpoint.latestSeq)
      lastSyncedAt.value = Date.now()
      cloudLogger.info('cloud operations pushed', {
        checkpoint: result.checkpoint.latestSeq,
        operationCount: operations.length,
      })
      return result
    })

  const pull = async (request?: Partial<SyncPullRequest>) =>
    await run('syncing', async () => {
      const currentRuntime = getRuntime()
      const sinceSeq = request?.sinceSeq ?? (await currentRuntime.metadata.getCheckpoint())
      const result = await currentRuntime.client.sync.pull({
        ...request,
        sinceSeq,
        schemaVersion: 1,
      })
      await currentRuntime.adapter.applyRemoteChanges(result.changes)
      await currentRuntime.metadata.setCheckpoint(result.checkpoint.latestSeq)
      lastSyncedAt.value = Date.now()
      cloudLogger.info('cloud changes pulled', {
        changeCount: result.changes.length,
        checkpoint: result.checkpoint.latestSeq,
      })
      return result
    })

  const syncOnce = async () => await pull()

  return {
    hydrate,
    isConfigured,
    isEnabled,
    lastError,
    lastSyncedAt,
    login,
    logout,
    me,
    pull,
    push,
    pushSnapshot,
    register,
    serverUrl,
    session,
    status,
    syncOnce,
  }
})