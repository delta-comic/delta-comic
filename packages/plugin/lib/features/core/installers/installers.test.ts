import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  blob: vi.fn(async () => new Blob(['archive'])),
  downloadEphemeral: vi.fn(async () => new Uint8Array([110, 97, 116, 105, 118, 101])),
  get: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  prepareDevScript: vi.fn(async (_input: string, code: string) => `processed:${code}`),
  readLocalFile: vi.fn(async (path: string) => new File([path], 'local.zip')),
  text: vi.fn(async () => 'dev source'),
}))

vi.mock('ky', () => ({ default: { get: mocks.get } }))
vi.mock('@delta-comic/downloader', () => ({ downloadEphemeral: mocks.downloadEphemeral }))
vi.mock('../../../driver/init/native', () => ({
  prepareDevScript: mocks.prepareDevScript,
  readLocalFile: mocks.readLocalFile,
}))
vi.mock('../../../driver/init/storage', () => ({ isTauriRuntime: mocks.isTauriRuntime }))
vi.mock('../../../i18n', () => ({ pluginMessageKey: (key: string) => key }))

import { _PluginInstallByFallbackUrl } from './10_normalUrl'
import { _PluginInstallByLocal } from './20_local'
import { _PluginInstallByDev } from './30_dev'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockReturnValue({ blob: mocks.blob, text: mocks.text })
  mocks.isTauriRuntime.mockReturnValue(false)
})

describe('fallback URL installer', () => {
  it('downloads URL files for install, update, and metadata discovery', async () => {
    const installer = new _PluginInstallByFallbackUrl()
    const input = 'https://plugins.test/releases/fixture.zip'

    const installed = await installer.download(input)
    const updated = await installer.update({ installInput: input } as never)
    const metadata = await installer.fetchPluginMetaFile(input)

    expect(installer.isMatched(input)).toBe(true)
    expect(installer.isMatched('not a url')).toBe(false)
    expect([installed.name, updated.name, (metadata as File).name]).toEqual([
      'fixture.zip',
      'fixture.zip',
      'fixture.zip',
    ])
    expect(mocks.get).toHaveBeenCalledTimes(3)
    expect(mocks.get).toHaveBeenCalledWith(input, { retry: 3, timeout: 300_000 })
  })

  it('uses a safe fallback filename for URL roots', async () => {
    const installer = new _PluginInstallByFallbackUrl()

    await expect(installer.download('https://plugins.test')).resolves.toMatchObject({
      name: 'plugins.test',
    })
  })

  it('uses the ephemeral native backend in Tauri without falling back to ky', async () => {
    const installer = new _PluginInstallByFallbackUrl()
    mocks.isTauriRuntime.mockReturnValue(true)

    const file = await installer.download(
      'https://plugins.test/releases/My%20Plugin.zip?signature=secret',
    )

    expect(file.name).toBe('My Plugin.zip')
    await expect(file.text()).resolves.toBe('native')
    expect(mocks.downloadEphemeral).toHaveBeenCalledWith(
      'https://plugins.test/releases/My%20Plugin.zip?signature=secret',
      { maxBytes: 128 * 1024 * 1024 },
    )
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('propagates native download failures without leaving the native path', async () => {
    const installer = new _PluginInstallByFallbackUrl()
    const failure = new Error('native download failed')
    mocks.isTauriRuntime.mockReturnValue(true)
    mocks.downloadEphemeral.mockRejectedValueOnce(failure)

    await expect(installer.download('https://plugins.test/plugin.zip')).rejects.toBe(failure)
    expect(mocks.get).not.toHaveBeenCalled()
  })
})

describe('local filesystem installer', () => {
  it('matches only Tauri local inputs and decodes their paths', async () => {
    const installer = new _PluginInstallByLocal()
    mocks.isTauriRuntime.mockReturnValue(true)
    const input = `local:${encodeURIComponent('/tmp/fixture.zip')}`

    await installer.download(input)
    await installer.update({ installInput: input } as never)
    await installer.fetchPluginMetaFile(input)

    expect(installer.isMatched(input)).toBe(true)
    expect(mocks.readLocalFile).toHaveBeenCalledTimes(3)
    expect(mocks.readLocalFile).toHaveBeenCalledWith('/tmp/fixture.zip')
    mocks.isTauriRuntime.mockReturnValue(false)
    expect(installer.isMatched(input)).toBe(false)
    expect(installer.isMatched('https://plugins.test/fixture.zip')).toBe(false)
  })
})

describe('development server installer', () => {
  it.each([
    ['localhost', 'http://localhost:6173/__vite-plugin-monkey.install.user.js'],
    ['127.0.0.1:7000', 'http://127.0.0.1:7000/__vite-plugin-monkey.install.user.js'],
  ])('downloads and prepares development scripts from %s', async (input, expectedPrefix) => {
    const installer = new _PluginInstallByDev()

    const file = await installer.download(input)

    expect(installer.isMatched(input)).toBe(true)
    expect(mocks.get).toHaveBeenCalledWith(expect.stringContaining(expectedPrefix))
    expect(mocks.prepareDevScript).toHaveBeenCalledWith(input, 'dev source')
    expect(file.name).toBe('us.js')
    await expect(file.text()).resolves.toBe('processed:dev source')
  })

  it('supports update/metadata paths and rejects non-development inputs', async () => {
    const installer = new _PluginInstallByDev()

    await installer.update({ installInput: 'localhost' } as never)
    await installer.fetchPluginMetaFile('localhost')

    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(installer.isMatched('plugins.test')).toBe(false)
    expect(installer.isMatched('localhost/path')).toBe(false)
  })
})