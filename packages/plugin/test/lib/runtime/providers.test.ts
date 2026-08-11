import type { PluginArchiveDB } from '@delta-comic/db'
import { describe, expect, it, vi } from 'vitest'

import { defineDeltaComicPlugin } from '../../../lib/api'
import {
  InstalledPluginCandidateProvider,
  type PluginArchiveRepository,
  type PluginModuleReader,
} from '../../../lib/install'
import { defineInternalPlugin } from '../../../lib/kernel'
import {
  CompositePluginCandidateProvider,
  InternalPluginCandidateProvider,
} from '../../../lib/runtime'

const manifest = (id: string) => ({
  apiVersion: 1 as const,
  author: 'test',
  description: 'test',
  name: { display: id, id },
  require: [],
  version: { plugin: '1.0.0', supportCore: '*' },
})

const archive = (id: string): PluginArchiveDB.Archive => ({
  displayName: id,
  enable: true,
  installerName: 'http',
  installInput: `https://example.test/${id}.zip`,
  loaderName: 'zip',
  meta: manifest(id),
  pluginName: id,
})

describe('plugin candidate providers', () => {
  it('normalizes internal and installed plugins to the same candidate contract', async () => {
    const factory = defineDeltaComicPlugin({ name: 'core' })
    const internal = new InternalPluginCandidateProvider(
      [defineInternalPlugin({ factory, manifest: manifest('core') })],
      { enabled: async (_plugin, fallback) => fallback, setEnabled: vi.fn() },
    )
    const repository: PluginArchiveRepository = {
      find: vi.fn(),
      list: async () => [archive('reader')],
      remove: vi.fn(),
      upsert: vi.fn(),
    }
    const reader: PluginModuleReader = {
      read: async () => ({ factory: defineDeltaComicPlugin({ name: 'reader' }) }),
    }
    const installed = new InstalledPluginCandidateProvider(repository, reader)
    const candidates = await new CompositePluginCandidateProvider([internal, installed]).list(
      new AbortController().signal,
    )

    expect(candidates.map(candidate => candidate.origin)).toEqual(['builtin', 'installed'])
    expect((await candidates[0].load(new AbortController().signal)).factory).toBe(factory)
    expect(candidates[0].management).toEqual({
      canDisable: true,
      canUninstall: false,
      canUpdate: false,
    })
    expect(candidates[1].management.canUninstall).toBe(true)
  })

  it('rejects collisions before dependency planning', async () => {
    const definition = defineInternalPlugin({
      factory: defineDeltaComicPlugin({ name: 'duplicate' }),
      manifest: manifest('duplicate'),
    })
    const provider = new CompositePluginCandidateProvider([
      new InternalPluginCandidateProvider([definition], {
        enabled: async (_plugin, fallback) => fallback,
        setEnabled: vi.fn(),
      }),
      new InternalPluginCandidateProvider([definition], {
        enabled: async (_plugin, fallback) => fallback,
        setEnabled: vi.fn(),
      }),
    ])

    await expect(provider.list(new AbortController().signal)).rejects.toThrow(
      'duplicate plugin candidate',
    )
  })

  it('prefers an internal plugin over a stale installed archive with the same id', async () => {
    const factory = defineDeltaComicPlugin({ name: 'core' })
    const internal = new InternalPluginCandidateProvider(
      [defineInternalPlugin({ factory, manifest: manifest('core') })],
      { enabled: async (_plugin, fallback) => fallback, setEnabled: vi.fn() },
    )
    const repository: PluginArchiveRepository = {
      find: vi.fn(),
      list: async () => [archive('core')],
      remove: vi.fn(),
      upsert: vi.fn(),
    }
    const installed = new InstalledPluginCandidateProvider(repository, {
      read: async () => ({ factory: defineDeltaComicPlugin({ name: 'core' }) }),
    })

    const candidates = await new CompositePluginCandidateProvider([installed, internal]).list(
      new AbortController().signal,
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0].origin).toBe('builtin')
    expect((await candidates[0].load(new AbortController().signal)).factory).toBe(factory)
  })
})