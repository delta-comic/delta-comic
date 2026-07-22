import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Downloader, type DownloaderTransport } from './index'

describe('Downloader', () => {
  const invoke = vi.fn()
  const listen = vi.fn()
  let instanceSequence = 0
  let downloader: Downloader

  beforeEach(() => {
    vi.clearAllMocks()
    listen.mockResolvedValue(vi.fn())
    downloader = Downloader.create({
      key: `test-${++instanceSequence}`,
      transport: { invoke, listen } as unknown as DownloaderTransport,
    })
  })

  it('registers created instances for static retrieval and rejects duplicate keys', () => {
    expect(Downloader.get(downloader.key)).toBe(downloader)
    expect(() =>
      Downloader.create({
        key: downloader.key,
        transport: { invoke, listen } as unknown as DownloaderTransport,
      }),
    ).toThrow('already exists')
  })

  it('uses namespaced downloader commands through instance methods', async () => {
    invoke.mockResolvedValue({ id: 'task' })
    await downloader.enqueueUrl({ url: 'https://example.com/file.zip' })
    await downloader.pauseTask('task')
    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin:downloader|enqueue_url', {
      input: { url: 'https://example.com/file.zip' },
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|pause_task', { id: 'task' })
  })

  it.each([
    ['ArrayBuffer', new Uint8Array([1, 2, 3]).buffer],
    ['Uint8Array', new Uint8Array([4, 5, 6])],
    ['Android JSON bytes', [7, 8, 9]],
  ])('normalizes %s ephemeral responses and forwards options', async (_, response) => {
    invoke.mockResolvedValue(response)

    const bytes = await downloader.downloadEphemeral('https://plugins.test/plugin.zip', {
      headers: { 'x-plugin-channel': 'stable' },
      maxBytes: 1024,
      secretRef: 'plugin-download',
    })

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect([...bytes]).toEqual(Array.from(new Uint8Array(response as never)))
    expect(invoke).toHaveBeenCalledWith('plugin:downloader|download_ephemeral', {
      headers: { 'x-plugin-channel': 'stable' },
      maxBytes: 1024,
      secretRef: 'plugin-download',
      url: 'https://plugins.test/plugin.zip',
    })
  })

  it('propagates ephemeral download failures without another backend', async () => {
    const failure = new Error('download failed')
    invoke.mockRejectedValue(failure)

    await expect(downloader.downloadEphemeral('https://plugins.test/plugin.zip')).rejects.toBe(
      failure,
    )
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('creates and deletes opaque native credential references', async () => {
    invoke.mockResolvedValueOnce('credential:550e8400-e29b-41d4-a716-446655440000')
    invoke.mockResolvedValueOnce(undefined)

    const secretRef = await downloader.storeSecret('Bearer private-token')
    await downloader.deleteSecret(secretRef)

    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin:downloader|store_secret', {
      value: 'Bearer private-token',
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|delete_secret', {
      secretRef: 'credential:550e8400-e29b-41d4-a716-446655440000',
    })
  })

  it('rejects malformed ephemeral responses', async () => {
    invoke.mockResolvedValue('not bytes')

    await expect(downloader.downloadEphemeral('https://plugins.test/plugin.zip')).rejects.toThrow(
      'invalid ephemeral response',
    )
  })

  it('merges settings patches with the current snapshot', async () => {
    const settings = {
      maxActiveTasks: 4,
      connectionBudget: 16,
      perTaskConnections: 8,
      allowMetered: true,
      seedOnComplete: false,
      revision: 2,
    }
    invoke.mockResolvedValueOnce(settings).mockImplementationOnce((_command, args) => args.settings)
    await expect(downloader.updateSettings({ maxActiveTasks: 6 })).resolves.toEqual({
      ...settings,
      maxActiveTasks: 6,
    })
  })

  it('reads settings and native platform limits', async () => {
    invoke.mockResolvedValueOnce({ maxActiveTasks: 4 })
    invoke.mockResolvedValueOnce({ connectionBudgetMax: 24, maxActiveTasks: 20 })

    await expect(downloader.getSettings()).resolves.toEqual({ maxActiveTasks: 4 })
    await expect(downloader.getCapabilities()).resolves.toEqual({
      connectionBudgetMax: 24,
      maxActiveTasks: 20,
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|get_capabilities', {})
  })

  it('exposes collection, detail, and destination snapshots', async () => {
    invoke.mockResolvedValue([])
    await downloader.getCollections()
    await downloader.getTaskDetail('task')
    await downloader.listDestinations()
    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin:downloader|get_collections', {})
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|get_task_detail', { id: 'task' })
    expect(invoke).toHaveBeenNthCalledWith(3, 'plugin:downloader|list_destinations', {})
  })

  it('opens the native destination picker without accepting a renderer path', async () => {
    invoke.mockResolvedValue(null)
    await expect(downloader.pickDestination()).resolves.toBeNull()
    expect(invoke).toHaveBeenCalledExactlyOnceWith('plugin:downloader|pick_destination', {})
  })

  it('owns event subscriptions and disposes each native listener once', async () => {
    const nativeUnlisten = vi.fn()
    let upsertListener: ((event: { task: { id: string }; revision: number }) => void) | undefined
    listen.mockImplementation(async (_event, handler) => {
      upsertListener = handler
      return nativeUnlisten
    })
    const upsert = vi.fn()

    const unlisten = await downloader.listen({ upsert })
    upsertListener?.({ task: { id: 'task' }, revision: 1 })
    expect(upsert).toHaveBeenCalledWith({ task: { id: 'task' }, revision: 1 })

    unlisten()
    unlisten()
    downloader.dispose()
    expect(nativeUnlisten).toHaveBeenCalledOnce()
  })

  it('cleans partial event subscriptions when a later listener fails', async () => {
    const nativeUnlisten = vi.fn()
    listen.mockResolvedValueOnce(nativeUnlisten).mockRejectedValueOnce(new Error('listen failed'))

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

  it('fully unregisters even when a transport listener fails during disposal', async () => {
    listen.mockResolvedValue(() => {
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