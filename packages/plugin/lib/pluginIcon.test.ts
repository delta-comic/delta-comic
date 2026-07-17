import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  createPluginAssetUrl: vi.fn(async (pluginId: string, path: string) => `blob:${pluginId}/${path}`),
}))

vi.mock('./driver/init/storage', () => ({ createPluginAssetUrl: mocks.createPluginAssetUrl }))

import { resolvePluginIconUrl } from './pluginIcon'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('plugin icon resolution', () => {
  it('keeps remote HTTP(S) icons without reading plugin storage', async () => {
    await expect(resolvePluginIconUrl('reader', 'https://cdn.example/icon.png')).resolves.toBe(
      'https://cdn.example/icon.png',
    )
    expect(mocks.createPluginAssetUrl).not.toHaveBeenCalled()
  })

  it('resolves local icons inside the installed plugin without breaking blob URLs', async () => {
    await expect(resolvePluginIconUrl('reader', './images/icon.png?v=2#mark')).resolves.toBe(
      'blob:reader/images/icon.png#mark',
    )
    expect(mocks.createPluginAssetUrl).toHaveBeenCalledWith('reader', 'images/icon.png')
  })

  it('rejects unsafe paths, unsupported schemes and unresolved local icons', async () => {
    await expect(resolvePluginIconUrl('reader', '../icon.png')).rejects.toThrow(
      'safe relative path',
    )
    await expect(resolvePluginIconUrl('reader', 'file:///tmp/icon.png')).rejects.toThrow(
      'credential-free HTTP(S)',
    )
    await expect(resolvePluginIconUrl(undefined, 'icon.png')).rejects.toThrow(
      'plugin id is required',
    )
  })
})