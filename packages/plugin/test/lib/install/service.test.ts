import type { PluginArchiveDB } from '@delta-comic/db'
import { describe, expect, it, vi } from 'vitest'

import { MemoryPluginFileStore } from '../../../lib/adapters'
import type {
  PluginArchiveRepository,
  PluginPackageCodec,
  PluginSourceResolver,
} from '../../../lib/install'
import { PluginInstallService } from '../../../lib/install'

const manifest = (version: string) => ({
  apiVersion: 1 as const,
  author: 'test',
  description: 'test',
  name: { display: 'Example', id: 'example' },
  require: [],
  version: { plugin: version, supportCore: '*' },
})

const archive = (version: string): PluginArchiveDB.Archive => ({
  displayName: 'Example',
  enable: true,
  installerName: 'local',
  installInput: '',
  loaderName: 'zip',
  meta: manifest(version),
  pluginName: 'example',
})

const resolver: PluginSourceResolver = {
  id: 'local',
  matches: () => true,
  resolve: async () => ({
    file: new File(['package'], 'plugin.zip'),
    installInput: '',
    resolverId: 'local',
  }),
}

const codec: PluginPackageCodec = {
  id: 'zip',
  decode: async () => ({
    codecId: 'zip',
    files: new Map([['index.mjs', new TextEncoder().encode('new')]]),
    manifest: manifest('2.0.0'),
  }),
  matches: () => true,
}

describe('PluginInstallService', () => {
  it('restores both files and metadata when persistence fails', async () => {
    const files = new MemoryPluginFileStore()
    await (
      await files.replace('example', new Map([['index.mjs', new TextEncoder().encode('old')]]))
    ).commit()
    let current = archive('1.0.0')
    const repository: PluginArchiveRepository = {
      find: async () => current,
      list: async () => [current],
      remove: vi.fn(),
      upsert: async value => {
        if (value.meta.version.plugin === '2.0.0') throw new Error('database unavailable')
        current = value
      },
    }
    const service = new PluginInstallService({
      codecs: [codec],
      files,
      repository,
      resolvers: [resolver],
    })

    await expect(service.install(new File([], 'plugin.zip'))).rejects.toThrow(
      'database unavailable',
    )
    expect(new TextDecoder().decode(await files.read('example', 'index.mjs'))).toBe('old')
    expect(current.meta.version.plugin).toBe('1.0.0')
  })

  it('rejects ids reserved by internal plugins before replacing files', async () => {
    const files = new MemoryPluginFileStore()
    const repository: PluginArchiveRepository = {
      find: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      upsert: vi.fn(),
    }
    const service = new PluginInstallService({
      codecs: [codec],
      files,
      repository,
      reservedIds: new Set(['example']),
      resolvers: [resolver],
    })

    await expect(service.install(new File([], 'plugin.zip'))).rejects.toThrow('reserved')
    expect(repository.upsert).not.toHaveBeenCalled()
  })
})