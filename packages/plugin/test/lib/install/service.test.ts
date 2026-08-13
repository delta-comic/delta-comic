import type { PluginArchiveDB } from '@delta-comic/db'
import type { PluginManifest } from '@delta-comic/model'
import { describe, expect, it, vi } from 'vitest'

import { MemoryPluginFileStore } from '../../../lib/adapters'
import type {
  PluginArchiveRepository,
  PluginPackageCodec,
  PluginSourceResolver,
} from '../../../lib/install'
import { PluginInstallService } from '../../../lib/install'

const manifest = (version: string): PluginManifest => ({
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

const packageFor = (pluginManifest: PluginManifest) => ({
  codecId: 'zip',
  files: new Map([['index.mjs', new TextEncoder().encode(pluginManifest.name.id)]]),
  manifest: pluginManifest,
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
  decode: async () => packageFor(manifest('2.0.0')),
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

  it('reports each installation phase', async () => {
    const files = new MemoryPluginFileStore()
    const repository: PluginArchiveRepository = {
      find: async () => undefined,
      list: async () => [],
      remove: vi.fn(),
      upsert: vi.fn(),
    }
    const service = new PluginInstallService({
      codecs: [codec],
      files,
      repository,
      resolvers: [resolver],
    })
    const report = vi.fn()

    await service.install(new File([], 'plugin.zip'), undefined, report)

    expect(report.mock.calls.map(([progress]) => progress)).toEqual([
      { phase: 'resolve', progress: 0 },
      { description: 'plugin.zip', phase: 'resolve', progress: 100 },
      { description: 'zip', phase: 'decode', progress: 0 },
      { description: 'example', phase: 'decode', progress: 100 },
      { description: 'example', phase: 'persist', progress: 50 },
      { description: 'example', phase: 'persist', progress: 100 },
    ])
  })

  it('installs downloadable dependencies before the requested plugin', async () => {
    const files = new MemoryPluginFileStore()
    const current = new Map<string, PluginArchiveDB.Archive>()
    const repository: PluginArchiveRepository = {
      find: async plugin => current.get(plugin),
      list: async () => [...current.values()],
      remove: async plugin => {
        current.delete(plugin)
      },
      upsert: async value => {
        current.set(value.pluginName, value)
      },
    }
    const packages = new Map([
      ['ap:base', packageFor({ ...manifest('1.0.0'), name: { display: 'Base', id: 'base' } })],
      [
        'ap:shared',
        packageFor({ ...manifest('1.0.0'), name: { display: 'Shared', id: 'shared' } }),
      ],
      [
        'local',
        packageFor({
          ...manifest('2.0.0'),
          name: { display: 'Example', id: 'example' },
          require: [
            { id: 'base', download: 'ap:base' },
            { id: 'shared', download: 'ap:shared' },
            { id: 'base', download: 'ap:base' },
            { id: 'core', download: 'ap:core' },
          ],
        }),
      ],
    ])
    const inputs: string[] = []
    const source: PluginSourceResolver = {
      id: 'catalog',
      matches: input => typeof input === 'string',
      resolve: async input => {
        const key = String(input)
        inputs.push(key)
        return { file: new File([key], `${key}.zip`), installInput: key, resolverId: 'catalog' }
      },
    }
    const packageCodec: PluginPackageCodec = {
      id: 'zip',
      matches: () => true,
      decode: async file =>
        packages.get(file.name.replace('.zip', '')) ?? packageFor(manifest('1')),
    }
    const service = new PluginInstallService({
      codecs: [packageCodec],
      files,
      repository,
      reservedIds: new Set(['core']),
      resolvers: [source],
    })

    await service.install('local')

    expect(inputs).toEqual(['local', 'ap:base', 'ap:shared'])
    expect([...current.keys()]).toEqual(['base', 'shared', 'example'])
  })

  it('rejects a dependency package whose id differs from the declaration', async () => {
    const files = new MemoryPluginFileStore()
    const current = new Map<string, PluginArchiveDB.Archive>()
    const repository: PluginArchiveRepository = {
      find: async plugin => current.get(plugin),
      list: async () => [],
      remove: async plugin => {
        current.delete(plugin)
      },
      upsert: async value => {
        current.set(value.pluginName, value)
      },
    }
    const packageCodec: PluginPackageCodec = {
      id: 'zip',
      matches: () => true,
      decode: async file =>
        packageFor(
          file.name.startsWith('root')
            ? { ...manifest('1.0.0'), require: [{ id: 'base', download: 'dependency' }] }
            : { ...manifest('1.0.0'), name: { display: 'Other', id: 'other' } },
        ),
    }
    const source: PluginSourceResolver = {
      id: 'source',
      matches: () => true,
      resolve: async input => ({
        file: new File([], `${input}.zip`),
        installInput: String(input),
        resolverId: 'source',
      }),
    }
    const service = new PluginInstallService({
      codecs: [packageCodec],
      files,
      repository,
      resolvers: [source],
    })

    await expect(service.install('root')).rejects.toThrow('downloaded as "other"')
    expect(current).toHaveLength(0)
  })

  it('restores files and metadata when uninstall persistence fails', async () => {
    const files = new MemoryPluginFileStore()
    await (
      await files.replace('example', new Map([['index.mjs', new TextEncoder().encode('old')]]))
    ).commit()
    let current: PluginArchiveDB.Archive | undefined = archive('1.0.0')
    const repository: PluginArchiveRepository = {
      find: async () => current,
      list: async () => (current ? [current] : []),
      remove: async () => {
        current = undefined
        throw new Error('database unavailable')
      },
      upsert: async value => {
        current = value
      },
    }
    const service = new PluginInstallService({
      codecs: [codec],
      files,
      repository,
      resolvers: [resolver],
    })

    await expect(service.uninstall('example')).rejects.toThrow('database unavailable')
    expect(new TextDecoder().decode(await files.read('example', 'index.mjs'))).toBe('old')
    expect(current?.meta.version.plugin).toBe('1.0.0')
  })
})