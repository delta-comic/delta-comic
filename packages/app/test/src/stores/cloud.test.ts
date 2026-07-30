import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
})

const { configState, createAppCloudRuntime } = vi.hoisted(() => ({
  configState: { current: { cloudEnabled: true, cloudServerUrl: ' https://cloud.test/ ' } },
  createAppCloudRuntime: vi.fn(),
}))

vi.mock('@delta-comic/plugin', () => ({
  useConfig: () => ({ $loadApp: () => ({ data: { value: configState.current } }) }),
}))

vi.mock('@/cloud', () => ({ createAppCloudRuntime }))

import { CloudClientError, CloudDisabledError } from '@delta-comic/server'

import { useCloudStore } from '../../../src/stores/cloud'

const session = {
  terminal: { terminalUuid: 'terminal-1' },
  tokens: {
    accessExpiresAt: 10,
    accessToken: 'access',
    refreshExpiresAt: 20,
    refreshToken: 'refresh',
  },
  user: { id: 'user-1', loginName: 'reader' },
}

const createRuntime = () => ({
  adapter: {
    applyRemoteChanges: vi.fn(async () => undefined),
    collectSnapshot: vi.fn(async () => ({ config: [{ belongTo: 'app' }] })),
  },
  client: {
    auth: {
      login: vi.fn(async () => session),
      logout: vi.fn(async () => undefined),
      me: vi.fn(async () => session.user),
      register: vi.fn(async () => session),
    },
    sync: {
      pull: vi.fn(async () => ({ changes: [{ serverSeq: 3 }], checkpoint: { latestSeq: 3 } })),
      push: vi.fn(async () => ({ checkpoint: { latestSeq: 4 } })),
      snapshot: vi.fn(async () => ({ checkpoint: { latestSeq: 5 } })),
    },
  },
  metadata: { getCheckpoint: vi.fn(async () => 2), setCheckpoint: vi.fn(async () => undefined) },
  sessionStorage: {
    clearSession: vi.fn(async () => undefined),
    getSession: vi.fn(async () => session),
  },
})

describe('cloud store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configState.current = { cloudEnabled: true, cloudServerUrl: ' https://cloud.test/ ' }
    createAppCloudRuntime.mockReset()
  })

  it('normalizes configuration and reuses one runtime across authenticated actions', async () => {
    const runtime = createRuntime()
    createAppCloudRuntime.mockReturnValue(runtime)
    const store = useCloudStore()

    expect(store.isEnabled).toBe(true)
    expect(store.isConfigured).toBe(true)
    expect(store.serverUrl).toBe('https://cloud.test/')
    await expect(store.login({ loginName: 'reader', password: 'secret' })).resolves.toBe(session)
    await expect(store.me()).resolves.toEqual(session.user)

    expect(createAppCloudRuntime).toHaveBeenCalledExactlyOnceWith({
      enabled: true,
      serverUrl: 'https://cloud.test/',
    })
    expect(runtime.client.auth.login).toHaveBeenCalledWith({
      loginName: 'reader',
      password: 'secret',
    })
    expect(store.session).toBe(session)
    expect(store.status).toBe('idle')
    expect(store.lastError).toBeUndefined()
  })

  it('rejects disabled operations with the domain error and always restores idle state', async () => {
    configState.current = { cloudEnabled: false, cloudServerUrl: 'https://cloud.test' }
    const store = useCloudStore()

    await expect(store.login({ loginName: 'reader', password: 'secret' })).rejects.toBeInstanceOf(
      CloudDisabledError,
    )

    expect(store.lastError).toBeInstanceOf(CloudDisabledError)
    expect(store.lastError?.code).toBe('CLOUD_DISABLED')
    expect(store.status).toBe('idle')
    expect(createAppCloudRuntime).not.toHaveBeenCalled()
  })

  it('wraps unexpected errors but preserves an existing cloud client error', async () => {
    const runtime = createRuntime()
    createAppCloudRuntime.mockReturnValue(runtime)
    runtime.client.auth.login.mockRejectedValueOnce(new Error('socket closed'))
    const store = useCloudStore()

    await expect(store.login({ loginName: 'reader', password: 'secret' })).rejects.toMatchObject({
      code: 'CLOUD_APP_ERROR',
      message: 'socket closed',
    })
    expect(store.status).toBe('idle')

    const domainError = new CloudClientError('TOKEN_EXPIRED', 'expired', 401)
    runtime.client.auth.login.mockRejectedValueOnce(domainError)
    await expect(store.login({ loginName: 'reader', password: 'secret' })).rejects.toBe(domainError)
    expect(store.lastError).toBe(domainError)
  })

  it('hydrates and logs out through disabled storage without contacting auth endpoints', async () => {
    configState.current = { cloudEnabled: false, cloudServerUrl: '' }
    const runtime = createRuntime()
    createAppCloudRuntime.mockReturnValue(runtime)
    const store = useCloudStore()

    await expect(store.hydrate()).resolves.toBe(session)
    expect(createAppCloudRuntime).toHaveBeenCalledExactlyOnceWith({ enabled: false, serverUrl: '' })
    await store.logout()

    expect(runtime.client.auth.logout).not.toHaveBeenCalled()
    expect(runtime.sessionStorage.clearSession).toHaveBeenCalledOnce()
    expect(store.session).toBeNull()
  })

  it('pushes snapshots and operations before advancing checkpoints', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123_456)
    const runtime = createRuntime()
    createAppCloudRuntime.mockReturnValue(runtime)
    const store = useCloudStore()
    const operations = [{ action: 'delete', collection: 'config', entityId: 'app' }] as never[]

    await store.pushSnapshot()
    expect(runtime.adapter.collectSnapshot).toHaveBeenCalledOnce()
    expect(runtime.client.sync.snapshot).toHaveBeenCalledWith({
      collections: { config: [{ belongTo: 'app' }] },
      schemaVersion: 1,
      snapshotId: expect.any(String),
    })
    expect(runtime.client.sync.snapshot).toHaveBeenCalledBefore(runtime.metadata.setCheckpoint)
    expect(runtime.metadata.setCheckpoint).toHaveBeenLastCalledWith(5)

    await store.push(operations)
    expect(runtime.client.sync.push).toHaveBeenCalledWith({ operations, schemaVersion: 1 })
    expect(runtime.metadata.setCheckpoint).toHaveBeenLastCalledWith(4)
    expect(store.lastSyncedAt).toBe(123_456)
    expect(store.status).toBe('idle')
  })

  it('pulls from persisted or explicit checkpoints and applies changes before committing progress', async () => {
    const runtime = createRuntime()
    createAppCloudRuntime.mockReturnValue(runtime)
    const store = useCloudStore()

    await store.pull()
    expect(runtime.metadata.getCheckpoint).toHaveBeenCalledOnce()
    expect(runtime.client.sync.pull).toHaveBeenNthCalledWith(1, { sinceSeq: 2, schemaVersion: 1 })
    expect(runtime.adapter.applyRemoteChanges).toHaveBeenCalledWith([{ serverSeq: 3 }])
    expect(runtime.adapter.applyRemoteChanges).toHaveBeenCalledBefore(
      runtime.metadata.setCheckpoint,
    )
    expect(runtime.metadata.setCheckpoint).toHaveBeenLastCalledWith(3)

    runtime.metadata.getCheckpoint.mockClear()
    await store.pull({ limit: 25, sinceSeq: 99 })
    expect(runtime.metadata.getCheckpoint).not.toHaveBeenCalled()
    expect(runtime.client.sync.pull).toHaveBeenNthCalledWith(2, {
      limit: 25,
      schemaVersion: 1,
      sinceSeq: 99,
    })
  })
})