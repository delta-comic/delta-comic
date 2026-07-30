import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  appLocalDataDir: vi.fn(async () => '/app-data'),
  decodeDevMetaFromCode: vi.fn((code: string) => ({ code, name: { id: 'web' } })),
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  listen: vi.fn(),
  mkdir: vi.fn(async () => undefined),
  unlisten: vi.fn(),
  writeFile: vi.fn(async () => undefined),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: mocks.appLocalDataDir,
  join: mocks.join,
}))
vi.mock('@tauri-apps/plugin-fs', () => ({ mkdir: mocks.mkdir, writeFile: mocks.writeFile }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))
vi.mock('../../../../lib/driver/init/storage', () => ({
  decodeDevMetaFromCode: mocks.decodeDevMetaFromCode,
  isTauriRuntime: mocks.isTauriRuntime,
}))

import {
  createNativeOperationId,
  decodeDevMeta,
  decodeZipMeta,
  installDev,
  installZip,
  prepareDevScript,
  readLocalFile,
  writeNativeTempFile,
} from '../../../../lib/driver/init/native'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-14T08:00:00Z'))
  mocks.isTauriRuntime.mockReturnValue(false)
  mocks.listen.mockResolvedValue(mocks.unlisten)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('native plugin file helpers', () => {
  it('creates operation ids through the platform crypto provider', () => {
    expect(createNativeOperationId()).toMatch(/^[\da-f-]{36}$/i)
  })

  it('writes sanitized temporary files under app local data', async () => {
    const randomUUID = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-4000-8000-000000000001')
    const file = new File([new Uint8Array([1, 2, 3])], '../unsafe\\plugin.zip')

    await expect(writeNativeTempFile(file)).resolves.toBe(
      `/app-data/plugin/__temp__/${Date.parse('2026-07-14T08:00:00Z')}-00000000-0000-4000-8000-000000000001-.._unsafe_plugin.zip`,
    )

    expect(randomUUID).toHaveBeenCalledOnce()
    expect(mocks.mkdir).toHaveBeenCalledWith('/app-data/plugin/__temp__', { recursive: true })
    expect(mocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.._unsafe_plugin.zip'),
      new Uint8Array([1, 2, 3]),
    )
  })

  it('converts the native byte response into a browser File', async () => {
    mocks.invoke.mockResolvedValueOnce({ bytes: [65, 66], name: 'fixture.zip' })

    const file = await readLocalFile('/tmp/fixture.zip')

    expect(mocks.invoke).toHaveBeenCalledWith('plugin:plugin|read_local_file', {
      path: '/tmp/fixture.zip',
    })
    expect(file.name).toBe('fixture.zip')
    await expect(file.text()).resolves.toBe('AB')
  })
})

describe('development script bridges', () => {
  it('rewrites loopback hosts in web mode and decodes metadata locally', async () => {
    await expect(prepareDevScript('192.168.1.8', 'localhost and 127.0.0.1')).resolves.toBe(
      '192.168.1.8 and 192.168.1.8',
    )
    await expect(decodeDevMeta('source code')).resolves.toEqual({
      code: 'source code',
      name: { id: 'web' },
    })
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('delegates development and zip commands to the Tauri plugin', async () => {
    mocks.isTauriRuntime.mockReturnValue(true)
    mocks.invoke
      .mockResolvedValueOnce('native script')
      .mockResolvedValueOnce({ name: { id: 'decoded' } })
      .mockResolvedValueOnce({ name: { id: 'installed' } })
      .mockResolvedValueOnce({ name: { id: 'zip' } })

    await expect(prepareDevScript('localhost', 'code')).resolves.toBe('native script')
    await expect(decodeDevMeta('code')).resolves.toMatchObject({ name: { id: 'decoded' } })
    await expect(installDev('code')).resolves.toMatchObject({ name: { id: 'installed' } })
    await expect(decodeZipMeta('/tmp/plugin.zip')).resolves.toMatchObject({ name: { id: 'zip' } })

    expect(mocks.invoke.mock.calls).toEqual([
      ['plugin:plugin|prepare_dev_script', { code: 'code', input: 'localhost' }],
      ['plugin:plugin|decode_dev_meta', { code: 'code' }],
      ['plugin:plugin|install_dev', { code: 'code' }],
      ['plugin:plugin|decode_zip_meta', { zipPath: '/tmp/plugin.zip' }],
    ])
  })
})

describe('native zip installation progress', () => {
  it('forwards only events for the current operation and always unsubscribes', async () => {
    let listener: ((event: any) => void) | undefined
    mocks.listen.mockImplementationOnce(async (_event: string, callback: (event: any) => void) => {
      listener = callback
      return mocks.unlisten
    })
    mocks.invoke.mockImplementationOnce(async () => {
      listener?.({ payload: { current: 1, opId: 'other', phase: 'extract', total: 2 } })
      listener?.({ payload: { current: 2, opId: 'operation', phase: 'done', total: 2 } })
      return { name: { id: 'fixture' } }
    })
    const progress = vi.fn()

    await expect(installZip('/tmp/plugin.zip', 'operation', progress)).resolves.toMatchObject({
      name: { id: 'fixture' },
    })

    expect(mocks.listen).toHaveBeenCalledWith('plugin://install-progress', expect.any(Function))
    expect(progress).toHaveBeenCalledExactlyOnceWith({
      current: 2,
      opId: 'operation',
      phase: 'done',
      total: 2,
    })
    expect(mocks.unlisten).toHaveBeenCalledOnce()
  })

  it('unsubscribes after native failures and skips listeners without a callback', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('install failed'))
    await expect(installZip('/tmp/plugin.zip', 'operation', vi.fn())).rejects.toThrow(
      'install failed',
    )
    expect(mocks.unlisten).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    mocks.invoke.mockResolvedValueOnce({ name: { id: 'fixture' } })
    await installZip('/tmp/plugin.zip', 'operation')
    expect(mocks.listen).not.toHaveBeenCalled()
  })
})