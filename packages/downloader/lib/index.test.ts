import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))

import {
  deleteSecret,
  downloadEphemeral,
  enqueueUrl,
  getCapabilities,
  getCollections,
  getSettings,
  getTaskDetail,
  listDestinations,
  pauseTask,
  pickDestination,
  storeSecret,
  updateSettings,
} from './index'

describe('downloader SDK', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses namespaced downloader commands', async () => {
    mocks.invoke.mockResolvedValue({ id: 'task' })
    await enqueueUrl({ url: 'https://example.com/file.zip' })
    await pauseTask('task')
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'plugin:downloader|enqueue_url', {
      input: { url: 'https://example.com/file.zip' },
    })
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|pause_task', { id: 'task' })
  })

  it.each([
    ['ArrayBuffer', new Uint8Array([1, 2, 3]).buffer],
    ['Uint8Array', new Uint8Array([4, 5, 6])],
    ['Android JSON bytes', [7, 8, 9]],
  ])('normalizes %s ephemeral responses and forwards options', async (_, response) => {
    mocks.invoke.mockResolvedValue(response)

    const bytes = await downloadEphemeral('https://plugins.test/plugin.zip', {
      headers: { 'x-plugin-channel': 'stable' },
      maxBytes: 1024,
      secretRef: 'plugin-download',
    })

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect([...bytes]).toEqual(Array.from(new Uint8Array(response as never)))
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:downloader|download_ephemeral', {
      headers: { 'x-plugin-channel': 'stable' },
      maxBytes: 1024,
      secretRef: 'plugin-download',
      url: 'https://plugins.test/plugin.zip',
    })
  })

  it('propagates ephemeral download failures without retrying through another backend', async () => {
    const failure = new Error('download failed')
    mocks.invoke.mockRejectedValue(failure)

    await expect(downloadEphemeral('https://plugins.test/plugin.zip')).rejects.toBe(failure)
    expect(mocks.invoke).toHaveBeenCalledOnce()
  })

  it('creates and deletes opaque native credential references', async () => {
    mocks.invoke.mockResolvedValueOnce('credential:550e8400-e29b-41d4-a716-446655440000')
    mocks.invoke.mockResolvedValueOnce(undefined)

    const secretRef = await storeSecret('Bearer private-token')
    await deleteSecret(secretRef)

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'plugin:downloader|store_secret', {
      value: 'Bearer private-token',
    })
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|delete_secret', {
      secretRef: 'credential:550e8400-e29b-41d4-a716-446655440000',
    })
  })

  it('rejects malformed ephemeral responses', async () => {
    mocks.invoke.mockResolvedValue('not bytes')

    await expect(downloadEphemeral('https://plugins.test/plugin.zip')).rejects.toThrow(
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
    mocks.invoke
      .mockResolvedValueOnce(settings)
      .mockImplementationOnce((_command, args) => args.settings)
    expect(await updateSettings({ maxActiveTasks: 6 })).toEqual({ ...settings, maxActiveTasks: 6 })
  })

  it('reads settings', async () => {
    mocks.invoke.mockResolvedValue({ maxActiveTasks: 4 })
    expect(await getSettings()).toEqual({ maxActiveTasks: 4 })
  })

  it('reads platform limits from the native backend', async () => {
    mocks.invoke.mockResolvedValue({ connectionBudgetMax: 24, maxActiveTasks: 20 })
    await expect(getCapabilities()).resolves.toEqual({
      connectionBudgetMax: 24,
      maxActiveTasks: 20,
    })
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:downloader|get_capabilities', {})
  })

  it('exposes collection, detail, and destination snapshots', async () => {
    mocks.invoke.mockResolvedValue([])
    await getCollections()
    await getTaskDetail('task')
    await listDestinations()
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'plugin:downloader|get_collections', {})
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'plugin:downloader|get_task_detail', {
      id: 'task',
    })
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, 'plugin:downloader|list_destinations', {})
  })

  it('opens the native destination picker without accepting a renderer path', async () => {
    mocks.invoke.mockResolvedValue(null)
    await expect(pickDestination()).resolves.toBeNull()
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('plugin:downloader|pick_destination', {})
  })
})