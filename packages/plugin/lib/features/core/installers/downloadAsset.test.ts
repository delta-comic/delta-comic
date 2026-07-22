import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  blob: vi.fn(async () => new Blob(['web'])),
  downloadEphemeral: vi.fn(async () => new Uint8Array([110, 97, 116, 105, 118, 101])),
  get: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
}))

vi.mock('@delta-comic/downloader', () => ({
  Downloader: { get: () => ({ downloadEphemeral: mocks.downloadEphemeral }) },
}))
vi.mock('ky', () => ({ default: { get: mocks.get } }))
vi.mock('../../../driver/init/storage', () => ({ isTauriRuntime: mocks.isTauriRuntime }))

import { defaultGitHubInstallerDependencies } from './40_github'
import {
  downloadInstallerAsset,
  MAX_PLUGIN_ASSET_BYTES,
  PLUGIN_DOWNLOAD_TIMEOUT_MS,
} from './downloadAsset'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.blob.mockResolvedValue(new Blob(['web']))
  mocks.downloadEphemeral.mockResolvedValue(new Uint8Array([110, 97, 116, 105, 118, 101]))
  mocks.get.mockReturnValue({ blob: mocks.blob })
  mocks.isTauriRuntime.mockReturnValue(false)
})

describe('installer asset downloads', () => {
  it('keeps ky as the web fallback with the requested retry policy', async () => {
    const asset = await downloadInstallerAsset('https://plugins.test/plugin.zip', { retry: 3 })

    await expect(asset.text()).resolves.toBe('web')
    expect(mocks.get).toHaveBeenCalledWith('https://plugins.test/plugin.zip', {
      retry: 3,
      timeout: PLUGIN_DOWNLOAD_TIMEOUT_MS,
    })
    expect(mocks.downloadEphemeral).not.toHaveBeenCalled()
  })

  it('uses ephemeral bytes in Tauri and respects an explicit response limit', async () => {
    mocks.isTauriRuntime.mockReturnValue(true)

    const asset = await downloadInstallerAsset('https://plugins.test/plugin.zip', {
      maxBytes: 4096,
      retry: 3,
    })

    await expect(asset.text()).resolves.toBe('native')
    expect(mocks.downloadEphemeral).toHaveBeenCalledWith('https://plugins.test/plugin.zip', {
      maxBytes: 4096,
    })
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('routes the default GitHub release asset downloader through the ephemeral backend', async () => {
    mocks.isTauriRuntime.mockReturnValue(true)

    const asset = await defaultGitHubInstallerDependencies.downloadAsset(
      'https://github.test/releases/plugin.zip',
    )

    await expect(asset.text()).resolves.toBe('native')
    expect(mocks.downloadEphemeral).toHaveBeenCalledWith(
      'https://github.test/releases/plugin.zip',
      { maxBytes: MAX_PLUGIN_ASSET_BYTES },
    )
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('does not silently fall back to web after a native failure', async () => {
    const failure = new Error('native failed')
    mocks.isTauriRuntime.mockReturnValue(true)
    mocks.downloadEphemeral.mockRejectedValueOnce(failure)

    await expect(
      downloadInstallerAsset('https://plugins.test/plugin.zip', { retry: 3 }),
    ).rejects.toBe(failure)
    expect(mocks.get).not.toHaveBeenCalled()
  })
})