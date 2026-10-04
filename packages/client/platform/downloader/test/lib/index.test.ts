import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { Downloader, type DownloaderRpc, type DownloaderRouter } from '../../lib/index'

type RpcTask = Awaited<ReturnType<DownloaderRpc['enqueue_url']>>

const createRpc = () =>
  ({
    attention: { on: vi.fn() },
    cancel_task: vi.fn(),
    delete_secret: vi.fn(),
    delete_task_files: vi.fn(),
    download_ephemeral: vi.fn(),
    enqueue_plan: vi.fn(),
    enqueue_torrent: vi.fn(),
    enqueue_url: vi.fn(),
    forget_task: vi.fn(),
    get_capabilities: vi.fn(),
    get_collections: vi.fn(),
    get_settings: vi.fn(),
    get_task: vi.fn(),
    get_task_detail: vi.fn(),
    list_destinations: vi.fn(),
    list_tasks: vi.fn(),
    move_queue: vi.fn(),
    pause_task: vi.fn(),
    pick_destination: vi.fn(),
    resume_task: vi.fn(),
    retry_task: vi.fn(),
    set_priority: vi.fn(),
    store_secret: vi.fn(),
    task_removed: { on: vi.fn() },
    task_upsert: { on: vi.fn() },
    update_settings: vi.fn(),
    update_source: vi.fn(),
  }) satisfies DownloaderRouter['downloader']

const task = (): RpcTask => ({
  id: 'task',
  collectionKey: null,
  assetKey: null,
  kind: 'http',
  title: 'file.zip',
  source: {
    type: 'http',
    mirrors: [],
    expectedSize: null,
    etag: null,
    lastModified: null,
    expiresAt: null,
  },
  destinationId: 'default',
  relativePath: 'file.zip',
  status: 'queued',
  priority: 0,
  queuePosition: 0,
  totalBytes: null,
  downloadedBytes: 0,
  speedBytesPerSecond: 0,
  errorCode: null,
  errorMessage: null,
  checksum: null,
  etag: null,
  lastModified: null,
  finalPath: null,
  retryCount: 0,
  createdAt: 0,
  updatedAt: 0,
  revision: 1,
})

describe('Downloader', () => {
  let instanceSequence = 0
  let rpc: ReturnType<typeof createRpc>
  let downloader: Downloader

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('window', { Proxy, __TAURI_INTERNALS__: { invoke: vi.fn() } })
    rpc = createRpc()
    downloader = Downloader.create({ key: `test-${++instanceSequence}`, rpc })
  })

  it('registers created instances for static retrieval and rejects duplicate keys', () => {
    expect(Downloader.get(downloader.key)).toBe(downloader)
    expect(() => Downloader.create({ key: downloader.key, rpc })).toThrow('already exists')
  })

  it('passes route arguments through typed downloader methods', async () => {
    const enqueueUrl = vi.spyOn(rpc, 'enqueue_url').mockResolvedValue(task())
    const pauseTask = vi.spyOn(rpc, 'pause_task').mockResolvedValue(task())

    await downloader.enqueueUrl({ url: 'https://example.com/file.zip' })
    await downloader.pauseTask('task')

    expect(enqueueUrl).toHaveBeenCalledExactlyOnceWith({
      url: 'https://example.com/file.zip',
      title: null,
      relativePath: null,
      destinationId: null,
      priority: null,
      checksum: null,
    })
    expect(pauseTask).toHaveBeenCalledExactlyOnceWith('task')
  })

  it('normalizes JSON ephemeral bytes and forwards options', async () => {
    const downloadEphemeral = vi.spyOn(rpc, 'download_ephemeral').mockResolvedValue([7, 8, 9])

    const bytes = await downloader.downloadEphemeral('https://plugins.test/plugin.zip', {
      headers: { 'x-plugin-channel': 'stable' },
      maxBytes: 1024,
      secretRef: 'plugin-download',
    })

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect([...bytes]).toEqual([7, 8, 9])
    expect(downloadEphemeral).toHaveBeenCalledExactlyOnceWith(
      'https://plugins.test/plugin.zip',
      { 'x-plugin-channel': 'stable' },
      'plugin-download',
      1024,
    )
  })

  it('propagates ephemeral download failures', async () => {
    const failure = new Error('download failed')
    const downloadEphemeral = vi.spyOn(rpc, 'download_ephemeral').mockRejectedValue(failure)

    await expect(downloader.downloadEphemeral('https://plugins.test/plugin.zip')).rejects.toBe(
      failure,
    )
    expect(downloadEphemeral).toHaveBeenCalledOnce()
  })

  it('creates and deletes opaque native credential references', async () => {
    const storeSecret = vi
      .spyOn(rpc, 'store_secret')
      .mockResolvedValue('credential:550e8400-e29b-41d4-a716-446655440000')
    const deleteSecret = vi.spyOn(rpc, 'delete_secret').mockResolvedValue(null)

    const secretRef = await downloader.storeSecret('Bearer private-token')
    await downloader.deleteSecret(secretRef)

    expect(storeSecret).toHaveBeenCalledExactlyOnceWith('Bearer private-token')
    expect(deleteSecret).toHaveBeenCalledExactlyOnceWith(
      'credential:550e8400-e29b-41d4-a716-446655440000',
    )
  })

  it('normalizes an empty ephemeral response', async () => {
    const downloadEphemeral = vi.spyOn(rpc, 'download_ephemeral').mockResolvedValue([])
    const result = await downloader.downloadEphemeral('https://plugins.test/plugin.zip')
    expect(result).toEqual(new Uint8Array())
    expect(downloadEphemeral).toHaveBeenCalledOnce()
  })

  it('merges settings patches with the current snapshot', async () => {
    const settings = {
      maxActiveTasks: 4,
      connectionBudget: 16,
      perTaskConnections: 8,
      allowMetered: true,
      seedOnComplete: false,
      seedRatio: null,
      seedSeconds: null,
      revision: 2,
    }
    const getSettings = vi.spyOn(rpc, 'get_settings').mockResolvedValue(settings)
    const updateSettings = vi.spyOn(rpc, 'update_settings').mockImplementation(async value => value)

    await expect(downloader.updateSettings({ maxActiveTasks: 6 })).resolves.toEqual({
      ...settings,
      maxActiveTasks: 6,
    })
    expect(getSettings).toHaveBeenCalledOnce()
    expect(updateSettings).toHaveBeenCalledExactlyOnceWith({ ...settings, maxActiveTasks: 6 })
  })

  it('reads settings and native platform limits', async () => {
    const getSettings = vi
      .spyOn(rpc, 'get_settings')
      .mockResolvedValue({
        maxActiveTasks: 4,
        connectionBudget: 16,
        perTaskConnections: 8,
        allowMetered: true,
        seedOnComplete: false,
        seedRatio: null,
        seedSeconds: null,
        revision: 1,
      })
    const getCapabilities = vi
      .spyOn(rpc, 'get_capabilities')
      .mockResolvedValue({ connectionBudgetMax: 24, maxActiveTasks: 20 })

    await expect(downloader.getSettings()).resolves.toMatchObject({ maxActiveTasks: 4 })
    await expect(downloader.getCapabilities()).resolves.toEqual({
      connectionBudgetMax: 24,
      maxActiveTasks: 20,
    })
    expect(getSettings).toHaveBeenCalledOnce()
    expect(getCapabilities).toHaveBeenCalledOnce()
  })

  it('exposes collection, detail, and destination snapshots', async () => {
    const getCollections = vi.spyOn(rpc, 'get_collections').mockResolvedValue([])
    const getTaskDetail = vi
      .spyOn(rpc, 'get_task_detail')
      .mockResolvedValue({ task: task(), completedRanges: [], torrent: null })
    const listDestinations = vi.spyOn(rpc, 'list_destinations').mockResolvedValue([])

    await downloader.getCollections()
    await downloader.getTaskDetail('task')
    await downloader.listDestinations()

    expect(getCollections).toHaveBeenCalledOnce()
    expect(getTaskDetail).toHaveBeenCalledExactlyOnceWith('task')
    expect(listDestinations).toHaveBeenCalledOnce()
  })

  it('opens the native destination picker without accepting a renderer path', async () => {
    const pickDestination = vi.spyOn(rpc, 'pick_destination').mockResolvedValue(null)
    await expect(downloader.pickDestination()).resolves.toBeNull()
    expect(pickDestination).toHaveBeenCalledOnce()
  })

  it('owns event subscriptions and disposes each native listener once', async () => {
    const nativeUnlisten = vi.fn()
    let upsertListener: Parameters<DownloaderRpc['task_upsert']['on']>[0] | undefined
    const onTaskUpsert = vi.spyOn(rpc.task_upsert, 'on').mockImplementation(async listener => {
      upsertListener = listener
      return nativeUnlisten
    })
    const upsert = vi.fn()

    const unlisten = await downloader.listen({ upsert })
    upsertListener?.({ task: task(), revision: 1 })
    expect(upsert).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: 'task', source: { type: 'http', mirrors: [] } }),
      revision: 1,
    })

    unlisten()
    unlisten()
    downloader.dispose()
    expect(onTaskUpsert).toHaveBeenCalledOnce()
    expect(nativeUnlisten).toHaveBeenCalledOnce()
  })

  it('cleans partial event subscriptions when a later listener fails', async () => {
    const nativeUnlisten = vi.fn()
    vi.spyOn(rpc.task_upsert, 'on').mockResolvedValue(nativeUnlisten)
    vi.spyOn(rpc.task_removed, 'on').mockRejectedValue(new Error('listen failed'))

    await expect(downloader.listen({ removed: vi.fn(), upsert: vi.fn() })).rejects.toThrow(
      'listen failed',
    )
    expect(nativeUnlisten).toHaveBeenCalledOnce()
  })

  it('unregisters disposed instances and rejects further commands', async () => {
    const key = downloader.key
    downloader.dispose()

    await expect(downloader.listTasks()).rejects.toThrow('is disposed')
    const replacement = Downloader.get(key)
    expect(replacement).not.toBe(downloader)
    replacement.dispose()
  })

  it('fully unregisters even when a native listener fails during disposal', async () => {
    vi.spyOn(rpc.attention, 'on').mockResolvedValue(() => {
      throw new Error('unlisten failed')
    })
    const key = downloader.key
    await downloader.onAttention(vi.fn())

    expect(() => downloader.dispose()).toThrow(AggregateError)
    const replacement = Downloader.get(key)
    expect(replacement).not.toBe(downloader)
    replacement.dispose()
  })
})