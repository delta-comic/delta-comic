import type { PluginArchiveDB } from '@delta-comic/db'
import type { PluginManifest } from '@delta-comic/model'
import { describe, expect, it, vi } from 'vitest'

import type { PluginFileReplacement, PluginFileStore } from '../../../lib/install'
import { DevServerPluginModuleReader, StoredPluginModuleReader } from '../../../lib/install'
import { PluginScope } from '../../../lib/kernel'

const manifest: PluginManifest = {
  apiVersion: 1 as const,
  author: 'test',
  description: 'test',
  name: { display: 'Reader', id: 'reader' },
  require: [],
  version: { plugin: '1.0.0', supportCore: '*' },
}

const archive = (pluginName: string, meta = manifest): PluginArchiveDB.Archive => ({
  displayName: meta.name.display,
  enable: true,
  installerName: 'local',
  installInput: '',
  loaderName: 'zip',
  meta,
  pluginName,
})

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
      new StoredPluginModuleReader(files).read(archive('reader'), new AbortController().signal),
    ).rejects.toThrow('no default factory')
    expect(release).toHaveBeenCalledWith('reader')
  })

  it('owns module URLs until the loaded module is disposed', async () => {
    const { files, release } = fileStore('export default () => ({ name: "reader" })')
    const loaded = await new StoredPluginModuleReader(files).read(
      archive('reader'),
      new AbortController().signal,
    )

    expect(release).not.toHaveBeenCalled()
    await loaded.dispose?.()
    expect(release).toHaveBeenCalledWith('reader')
  })

  it('defers plugin CSS injection to normal module activation', async () => {
    const { files } = fileStore('export default () => ({ name: "reader" })')
    vi.mocked(files.read).mockResolvedValue(new TextEncoder().encode('.reader { color: red }'))
    const style = { dataset: {}, remove: vi.fn(), textContent: '' }
    const append = vi.fn()
    vi.stubGlobal('document', { createElement: vi.fn(() => style), head: { append } })
    const loaded = await new StoredPluginModuleReader(files).read(
      archive('reader'),
      new AbortController().signal,
    )

    expect(append).not.toHaveBeenCalled()
    const scope = new PluginScope('reader')
    await loaded.activate?.(scope)
    expect(append).toHaveBeenCalledExactlyOnceWith(style)
    expect(style.textContent).toBe('.reader { color: red }')

    await scope.dispose()
    expect(style.remove).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('routes development archives to the network reader', () => {
    const reader = new DevServerPluginModuleReader()
    expect(reader.matches?.({ ...archive('reader'), loaderName: 'dev-server' })).toBe(true)
    expect(reader.matches?.(archive('reader'))).toBe(false)
  })
})