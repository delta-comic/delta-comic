import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { Destination } from '@/features/downloads/downloaderClient'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../public/runtime/host-libraries.umd.js')
})

const { client, handlers, sourceRefresh } = vi.hoisted(() => {
  const handlers: Record<string, ((event: unknown) => void) | undefined> = {}
  const task = {
    createdAt: 1,
    destinationId: 'default',
    downloadedBytes: 25,
    id: 'task-1',
    kind: 'http',
    priority: 5,
    queuePosition: 0,
    relativePath: 'file.bin',
    retryCount: 0,
    revision: 1,
    source: { mirrors: [{ url: 'https://example.test/file.bin' }], type: 'http' },
    speedBytesPerSecond: 10,
    status: 'downloading',
    title: 'File',
    totalBytes: 100,
    updatedAt: 1,
  }
  return {
    client: {
      cancelTask: vi.fn(async () => task),
      deleteTaskFiles: vi.fn(async () => undefined),
      enqueuePlan: vi.fn(async () => [task]),
      enqueueTorrent: vi.fn(async () => task),
      enqueueUrl: vi.fn(async () => task),
      forgetTask: vi.fn(async () => undefined),
      getCapabilities: vi.fn(async () => ({ connectionBudgetMax: 64, maxActiveTasks: 20 })),
      getCollections: vi.fn(async (): Promise<unknown[]> => []),
      getSettings: vi.fn(async () => ({
        allowMetered: true,
        connectionBudget: 16,
        maxActiveTasks: 4,
        perTaskConnections: 8,
        revision: 1,
        seedOnComplete: false,
      })),
      getTask: vi.fn(async () => task),
      getTaskDetail: vi.fn(async () => ({ completedRanges: [], task })),
      listDestinations: vi.fn(async () => []),
      listTasks: vi.fn(async () => [task]),
      listen: vi.fn(async (nextHandlers: Record<string, (event: unknown) => void>) => {
        Object.assign(handlers, nextHandlers)
        return vi.fn()
      }),
      moveQueue: vi.fn(async () => task),
      pauseTask: vi.fn(async () => ({ ...task, status: 'paused' })),
      pickDestination: vi.fn(async () => null),
      resumeTask: vi.fn(async () => task),
      retryTask: vi.fn(async () => task),
      setPriority: vi.fn(async () => task),
      updateSource: vi.fn(async () => task),
      updateSettings: vi.fn(async (patch: Record<string, unknown>) => ({
        ...(await client.getSettings()),
        ...patch,
        revision: 2,
      })),
    },
    handlers,
    sourceRefresh: {
      getPluginDownloadIdentity: vi.fn(),
      isCandidateCurrent: vi.fn(() => true),
      pluginStore: { $isLoaded: vi.fn(() => true), ready: new Set<string>() },
      prepare: vi.fn(),
    },
  }
})

vi.mock('@/features/downloads/downloaderClient', () => ({ downloaderClient: client }))
vi.mock('@delta-comic/model', () => ({
  uni: {
    content: {
      ContentPage: { contentPages: { get: vi.fn() }, downloadProviders: { get: vi.fn() } },
    },
  },
}))
vi.mock('@delta-comic/plugin', () => ({ usePluginStore: () => sourceRefresh.pluginStore }))
vi.mock('@/features/downloads/contentPlan', () => ({
  getPluginDownloadIdentity: sourceRefresh.getPluginDownloadIdentity,
}))
vi.mock('@/features/downloads/contentSourceRefresh', () => ({
  isContentSourceRefreshCandidateCurrent: sourceRefresh.isCandidateCurrent,
  prepareContentSourceRefresh: sourceRefresh.prepare,
}))

import { useDownloadsStore } from './downloads'

const refreshContext = {
  contentId: 'comic-1',
  contentType: ['reader', 'manga'],
  episodeId: 'episode-2',
  contentPageFingerprint: 'sha256:content-page-v1',
  plugin: 'reader',
  pluginIntegrity: 'sha256:archive-v1',
  pluginVersion: '1.0.0',
  providerFingerprint: 'sha256:provider-v1',
}

const waitingTask = () => ({
  assetKey: 'episode-2',
  collectionKey: 'reader:comic-1',
  createdAt: 1,
  destinationId: 'default',
  downloadedBytes: 25,
  errorCode: 'sourceExpired',
  errorMessage: 'authorization must be refreshed',
  id: 'task-1',
  kind: 'http',
  priority: 5,
  queuePosition: 0,
  relativePath: 'episode-2.cbz',
  retryCount: 0,
  revision: 2,
  source: { mirrors: [{ url: 'https://example.test/expired.cbz' }], type: 'http' },
  speedBytesPerSecond: 0,
  status: 'waitingForSource',
  title: 'Episode 2',
  totalBytes: 100,
  updatedAt: 2,
})

const collection = () => ({
  completedTasks: 0,
  createdAt: 1,
  destinationId: 'default',
  downloadedBytes: 25,
  key: 'reader:comic-1',
  refreshContext,
  taskCount: 1,
  title: 'Comic 1',
  totalBytes: 100,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

describe('useDownloadsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    for (const key of Object.keys(handlers)) delete handlers[key]
    client.getCollections.mockResolvedValue([])
    client.getCapabilities.mockResolvedValue({ connectionBudgetMax: 64, maxActiveTasks: 20 })
    client.getSettings.mockResolvedValue({
      allowMetered: true,
      connectionBudget: 16,
      maxActiveTasks: 4,
      perTaskConnections: 8,
      revision: 1,
      seedOnComplete: false,
    })
    client.listDestinations.mockResolvedValue([])
    client.listTasks.mockResolvedValue([
      {
        createdAt: 1,
        destinationId: 'default',
        downloadedBytes: 25,
        id: 'task-1',
        kind: 'http',
        priority: 5,
        queuePosition: 0,
        relativePath: 'file.bin',
        retryCount: 0,
        revision: 1,
        source: { mirrors: [{ url: 'https://example.test/file.bin' }], type: 'http' },
        speedBytesPerSecond: 10,
        status: 'downloading',
        title: 'File',
        totalBytes: 100,
        updatedAt: 1,
      },
    ])
    client.updateSource.mockResolvedValue({
      createdAt: 1,
      destinationId: 'default',
      downloadedBytes: 25,
      id: 'task-1',
      kind: 'http',
      priority: 5,
      queuePosition: 0,
      relativePath: 'file.bin',
      retryCount: 0,
      revision: 2,
      source: { mirrors: [{ url: 'https://example.test/refreshed.bin' }], type: 'http' },
      speedBytesPerSecond: 0,
      status: 'queued',
      title: 'File',
      totalBytes: 100,
      updatedAt: 2,
    })
    sourceRefresh.pluginStore.$isLoaded.mockReturnValue(true)
    sourceRefresh.isCandidateCurrent.mockReturnValue(true)
    sourceRefresh.prepare.mockReset()
  })

  it('loads the native snapshot and derives active totals', async () => {
    const store = useDownloadsStore()
    await store.connect()

    expect(store.tasks).toHaveLength(1)
    expect(store.activeTasks).toHaveLength(1)
    expect(store.aggregateSpeed).toBe(10)
    expect(store.capabilities.connectionBudgetMax).toBe(64)
    expect(client.listen).toHaveBeenCalledOnce()
    store.disconnect()
  })

  it('subscribes before loading the first snapshot and preserves an event newer than that snapshot', async () => {
    const snapshot = deferred<Awaited<ReturnType<typeof client.listTasks>>>()
    client.listTasks.mockReturnValueOnce(snapshot.promise)
    const store = useDownloadsStore()

    const connecting = store.connect()
    await vi.waitFor(() => {
      expect(client.listen).toHaveBeenCalledOnce()
      expect(client.listTasks).toHaveBeenCalledOnce()
    })
    expect(client.listen.mock.invocationCallOrder[0]).toBeLessThan(
      client.listTasks.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    handlers.upsert?.({
      revision: 2,
      task: {
        createdAt: 1,
        destinationId: 'default',
        downloadedBytes: 100,
        id: 'task-1',
        kind: 'http',
        priority: 5,
        queuePosition: 0,
        relativePath: 'file.bin',
        retryCount: 0,
        revision: 2,
        source: { mirrors: [{ url: '[redacted]' }], type: 'http' },
        speedBytesPerSecond: 0,
        status: 'completed',
        title: 'File',
        totalBytes: 100,
        updatedAt: 2,
      },
    })
    snapshot.resolve([
      {
        createdAt: 1,
        destinationId: 'default',
        downloadedBytes: 25,
        id: 'task-1',
        kind: 'http',
        priority: 5,
        queuePosition: 0,
        relativePath: 'file.bin',
        retryCount: 0,
        revision: 1,
        source: { mirrors: [{ url: 'https://example.test/file.bin' }], type: 'http' },
        speedBytesPerSecond: 10,
        status: 'downloading',
        title: 'File',
        totalBytes: 100,
        updatedAt: 1,
      },
    ])

    await connecting

    expect(store.tasks[0]).toMatchObject({ downloadedBytes: 100, revision: 2, status: 'completed' })
    store.disconnect()
  })

  it('disposes a listener that resolves after the final consumer disconnects', async () => {
    const dispose = vi.fn()
    const listener = deferred<typeof dispose>()
    client.listen.mockReturnValueOnce(listener.promise)
    const store = useDownloadsStore()

    const connecting = store.connect()
    await vi.waitFor(() => expect(client.listen).toHaveBeenCalledOnce())
    store.disconnect()
    listener.resolve(dispose)
    await connecting

    expect(dispose).toHaveBeenCalledOnce()
    expect(client.listTasks).not.toHaveBeenCalled()
  })

  it('applies contiguous committed events and refreshes after revision gaps', async () => {
    const store = useDownloadsStore()
    await store.connect()
    handlers.upsert?.({
      revision: 2,
      task: { ...store.tasks[0], downloadedBytes: 50, revision: 2 },
    })
    expect(store.tasks[0]?.downloadedBytes).toBe(50)

    handlers.removed?.({ revision: 3, taskId: 'task-1' })
    expect(store.tasks).toHaveLength(0)
    store.disconnect()
  })

  it('routes mutations through the client and refreshes the snapshot', async () => {
    const store = useDownloadsStore()
    await store.refresh()
    await store.pauseTask('task-1')
    await store.updateSettings({ maxActiveTasks: 8 })

    expect(client.pauseTask).toHaveBeenCalledWith('task-1')
    expect(client.updateSettings).toHaveBeenCalledWith({ maxActiveTasks: 8 })
    expect(client.listTasks).toHaveBeenCalledTimes(3)
  })

  it('pauses both running and queued tasks', async () => {
    const queued = { ...waitingTask(), id: 'task-2', status: 'queued' as const }
    const running = {
      ...waitingTask(),
      errorCode: undefined,
      id: 'task-1',
      status: 'downloading' as const,
    }
    client.listTasks.mockResolvedValue([running, queued])
    const store = useDownloadsStore()
    await store.refresh()

    await store.pauseAll()

    expect(store.pausableTasks).toHaveLength(2)
    expect(client.pauseTask).toHaveBeenCalledTimes(2)
    expect(client.pauseTask).toHaveBeenCalledWith('task-1')
    expect(client.pauseTask).toHaveBeenCalledWith('task-2')
  })

  it('registers only a destination returned by the native picker', async () => {
    const destination: Destination = {
      id: 'archive',
      isDefault: false,
      kind: 'desktopDirectory',
      label: 'Archive',
    }
    client.pickDestination.mockResolvedValue(destination as never)
    client.listDestinations.mockResolvedValue([destination] as never)
    const store = useDownloadsStore()

    await expect(store.pickDestination()).resolves.toEqual(destination)

    expect(client.pickDestination).toHaveBeenCalledExactlyOnceWith()
    expect(store.destinations).toEqual([destination])
  })

  it('refreshes a stable provider source with persisted plan and asset keys', async () => {
    const task = waitingTask()
    const refreshedSource = {
      mirrors: [{ url: 'https://example.test/refreshed.cbz' }],
      type: 'http',
    }
    const refreshSource = vi.fn(async () => refreshedSource)
    sourceRefresh.prepare.mockResolvedValue({
      candidate: {
        context: refreshContext,
        page: { id: 'comic-1' },
        pluginIdentity: { pluginVersion: '1.0.0' },
        provider: { refreshSource },
        providerFingerprint: 'sha256:provider-v1',
      },
      status: 'compatible',
    })
    client.listTasks.mockResolvedValue([task])
    client.getCollections.mockResolvedValue([collection()] as never)

    const store = useDownloadsStore()
    await store.refresh()

    await vi.waitFor(() => expect(client.updateSource).toHaveBeenCalledOnce())
    expect(refreshSource).toHaveBeenCalledWith(
      {
        assetKey: 'episode-2',
        page: { id: 'comic-1' },
        planKey: 'reader:comic-1',
        reason: 'expired',
        source: task.source,
      },
      expect.any(AbortSignal),
    )
    expect(client.updateSource).toHaveBeenCalledWith('task-1', refreshedSource)
    expect(store.sourceRefreshWarnings).toEqual([])
    store.disconnect()
  })

  it('waits for a full snapshot before passing an event-redacted source to the provider', async () => {
    const rawTask = waitingTask()
    const refreshSource = vi.fn(async input => input.source)
    sourceRefresh.prepare.mockResolvedValue({
      candidate: {
        context: refreshContext,
        page: { id: 'comic-1' },
        pluginIdentity: { pluginVersion: '1.0.0' },
        provider: { refreshSource },
        providerFingerprint: 'sha256:provider-v1',
      },
      status: 'compatible',
    })
    const store = useDownloadsStore()
    await store.connect()
    client.listTasks.mockResolvedValue([rawTask])
    client.getCollections.mockResolvedValue([collection()] as never)

    handlers.upsert?.({
      revision: rawTask.revision,
      task: { ...rawTask, source: { mirrors: [{ url: '[redacted]' }], type: 'http' } },
    })
    handlers.attention?.({
      code: 'sourceExpired',
      message: 'source expired',
      revision: rawTask.revision,
      taskId: rawTask.id,
    })
    await Promise.resolve()
    expect(refreshSource).not.toHaveBeenCalled()

    await store.refresh()
    await vi.waitFor(() => expect(refreshSource).toHaveBeenCalledOnce())

    expect(refreshSource.mock.calls[0]?.[0]).toMatchObject({ source: rawTask.source })
    store.disconnect()
  })

  it('does not update a source after the task is paused while its provider is resolving', async () => {
    const task = waitingTask()
    const pendingSource = deferred<typeof task.source>()
    const refreshSource = vi.fn(() => pendingSource.promise)
    sourceRefresh.prepare.mockResolvedValue({
      candidate: {
        context: refreshContext,
        page: { id: 'comic-1' },
        pluginIdentity: { pluginVersion: '1.0.0' },
        provider: { refreshSource },
        providerFingerprint: 'sha256:provider-v1',
      },
      status: 'compatible',
    })
    client.listTasks.mockResolvedValue([task])
    client.getCollections.mockResolvedValue([collection()] as never)
    const store = useDownloadsStore()
    await store.connect()
    await vi.waitFor(() => expect(refreshSource).toHaveBeenCalledOnce())

    handlers.upsert?.({ revision: 3, task: { ...task, revision: 3, status: 'paused' } })
    pendingSource.resolve(task.source)
    await Promise.resolve()
    await Promise.resolve()

    expect(client.updateSource).not.toHaveBeenCalled()
    store.disconnect()
  })

  it('requires a fresh user confirmation before changed plugin code can refresh a source', async () => {
    const task = waitingTask()
    const refreshedSource = {
      mirrors: [{ url: 'https://example.test/confirmed.cbz' }],
      type: 'http',
    }
    const refreshSource = vi.fn(async () => refreshedSource)
    const changes = [
      { code: 'plugin-version-changed', current: '2.0.0', recorded: '1.0.0' },
      {
        code: 'provider-fingerprint-changed',
        current: 'sha256:provider-v2',
        recorded: 'sha256:provider-v1',
      },
    ]
    sourceRefresh.prepare.mockResolvedValue({
      candidate: {
        context: refreshContext,
        page: { id: 'comic-1' },
        pluginIdentity: { pluginVersion: '2.0.0' },
        provider: { refreshSource },
        providerFingerprint: 'sha256:provider-v2',
      },
      changes,
      status: 'confirmation-required',
    })
    client.listTasks.mockResolvedValue([task])
    client.getCollections.mockResolvedValue([collection()] as never)

    const store = useDownloadsStore()
    await store.refresh()
    await vi.waitFor(() => expect(store.sourceRefreshWarnings).toHaveLength(1))

    expect(store.sourceRefreshWarnings[0]).toMatchObject({
      changes,
      status: 'confirmation-required',
      taskId: 'task-1',
    })
    expect(refreshSource).not.toHaveBeenCalled()
    expect(client.updateSource).not.toHaveBeenCalled()

    await store.confirmSourceRefresh('task-1')

    expect(refreshSource).toHaveBeenCalledOnce()
    expect(client.updateSource).toHaveBeenCalledExactlyOnceWith('task-1', refreshedSource)
    store.disconnect()
  })

  it('hard-blocks a reconstructed page identity mismatch', async () => {
    client.listTasks.mockResolvedValue([waitingTask()])
    client.getCollections.mockResolvedValue([collection()] as never)
    sourceRefresh.prepare.mockResolvedValue({
      current: { contentType: ['reader', 'novel'], plugin: 'reader' },
      expected: { contentType: ['reader', 'manga'], plugin: 'reader' },
      status: 'content-page-identity-mismatch',
    })

    const store = useDownloadsStore()
    await store.refresh()
    await vi.waitFor(() => expect(store.sourceRefreshWarnings).toHaveLength(1))

    expect(store.sourceRefreshWarnings[0]?.status).toBe('content-page-identity-mismatch')
    expect(client.updateSource).not.toHaveBeenCalled()
  })
})