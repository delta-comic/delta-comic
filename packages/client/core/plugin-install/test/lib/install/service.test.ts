import type { PluginArchiveDB } from '@delta-comic/db'
import type { PluginManifest } from '@delta-comic/model'
import { describe, expect, it, vi } from 'vite-plus/test'

import { MemoryPluginFileStore } from '../../../../plugin/lib/adapters'
import type {
  PluginArchiveRepository,
  PluginPackageCodec,
  PluginSourceResolver,
} from '../../../lib'
import { PluginInstallService } from '../../../lib'

const manifest = (version: string): PluginManifest => ({
  protocolVersion: 2,
  client: { entry: 'index.js' },
  resources: [],
  author: 'test',
  description: 'test',
  name: 'Example',
  id: 'example',

  version: version,
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
  files: new Map([['index.js', new TextEncoder().encode(pluginManifest.id)]]),
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
  it('persists development metadata while clearing stored files', async () => {
    const files = new MemoryPluginFileStore()
    await (
      await files.replace('example', new Map([['index.js', new TextEncoder().encode('old')]]))
    ).commit()
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
    const resolver: PluginSourceResolver = {
      id: 'dev-server',
      matches: input => input === 'dev:6173',
      resolve: async () => ({
        installInput: 'dev:6173',
        package: { codecId: 'dev-server', files: new Map(), manifest: manifest('2.0.0') },
        resolverId: 'dev-server',
        storage: 'remote',
      }),
    }
    const service = new PluginInstallService({
      codecs: [],
      files,
      repository,
      resolvers: [resolver],
    })

    const installed = await service.install('dev:6173')

    expect(installed).toMatchObject({ installInput: 'dev:6173', loaderName: 'dev-server' })
    await expect(files.read('example', 'index.js')).rejects.toThrow('not found')
    expect(current.get('example')?.loaderName).toBe('dev-server')
  })

  it('restores both files and metadata when persistence fails', async () => {
    const files = new MemoryPluginFileStore()
    await (
      await files.replace('example', new Map([['index.js', new TextEncoder().encode('old')]]))
    ).commit()
    let current = archive('1.0.0')
    const repository: PluginArchiveRepository = {
      find: async () => current,
      list: async () => [current],
      remove: vi.fn(),
      upsert: async value => {
        if (value.meta.version === '2.0.0') throw new Error('database unavailable')
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
    expect(new TextDecoder().decode(await files.read('example', 'index.js'))).toBe('old')
    expect(current.meta.version).toBe('1.0.0')
  })

  it('restores the previous version when activation validation fails after staging', async () => {
    const files = new MemoryPluginFileStore()
    await (
      await files.replace('example', new Map([['index.js', new TextEncoder().encode('old')]]))
    ).commit()
    let current = archive('1.0.0')
    const repository: PluginArchiveRepository = {
      find: async () => current,
      list: async () => [current],
      remove: vi.fn(),
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

    await expect(
      service.install(new File([], 'plugin.zip'), undefined, undefined, {
        afterStage: async () => {
          throw new Error('activation failed')
        },
      }),
    ).rejects.toThrow('activation failed')
    expect(current.meta.version).toBe('1.0.0')
    expect(new TextDecoder().decode(await files.read('example', 'index.js'))).toBe('old')
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

  it('restores files and metadata when uninstall persistence fails', async () => {
    const files = new MemoryPluginFileStore()
    await (
      await files.replace('example', new Map([['index.js', new TextEncoder().encode('old')]]))
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
    expect(new TextDecoder().decode(await files.read('example', 'index.js'))).toBe('old')
    expect(current?.meta.version).toBe('1.0.0')
  })
})