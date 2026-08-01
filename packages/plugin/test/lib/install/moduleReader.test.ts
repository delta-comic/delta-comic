import { describe, expect, it, vi } from 'vitest'

import type { PluginFileReplacement, PluginFileStore } from '../../../lib/install'
import { StoredPluginModuleReader } from '../../../lib/install'

const manifest = {
  apiVersion: 1 as const,
  author: 'test',
  description: 'test',
  name: { display: 'Reader', id: 'reader' },
  require: [],
  version: { plugin: '1.0.0', supportCore: '*' },
}

const fileStore = (moduleSource: string) => {
  const release = vi.fn()
  const files: PluginFileStore = {
    createAssetUrl: vi.fn(),
    createModuleUrl: async () =>
      `data:text/javascript,${encodeURIComponent(`${moduleSource}\n//# ${crypto.randomUUID()}`)}`,
    read: vi.fn(),
    release,
    remove: vi.fn(),
    replace: vi.fn<() => Promise<PluginFileReplacement>>(),
  }
  return { files, release }
}

describe('StoredPluginModuleReader', () => {
  it('releases module URLs when entry validation fails', async () => {
    const { files, release } = fileStore('export const value = 1')

    await expect(
      new StoredPluginModuleReader(files).read('reader', manifest, new AbortController().signal),
    ).rejects.toThrow('no default factory')
    expect(release).toHaveBeenCalledWith('reader')
  })

  it('owns module URLs until the loaded module is disposed', async () => {
    const { files, release } = fileStore('export default () => ({ name: "reader" })')
    const loaded = await new StoredPluginModuleReader(files).read(
      'reader',
      manifest,
      new AbortController().signal,
    )

    expect(release).not.toHaveBeenCalled()
    await loaded.dispose?.()
    expect(release).toHaveBeenCalledWith('reader')
  })
})