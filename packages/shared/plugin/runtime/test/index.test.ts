import type { PluginConfig } from '@delta-comic/plugin-api'
import type { PluginCandidate } from '@delta-comic/plugin-kernel'
import { describe, expect, it, vi } from 'vitest'

import {
  CompositePluginCandidateProvider,
  InternalPluginCandidateProvider,
  PluginStore,
} from '../lib'

const manifest = (id: string, name = id): PluginCandidate['manifest'] => ({
  protocolVersion: 1,
  id,
  name,
  version: '1.0.0',
  entry: 'index.js',
  entryType: 'plugin',
  resources: [],
})

const candidate = (id: string, origin: PluginCandidate['origin']): PluginCandidate => ({
  manifest: manifest(id),
  origin,
  enabled: true,
  management: {},
  load: async () => ({ factory: () => ({ name: id }) }),
})

describe('PluginStore', () => {
  it('publishes models only after activation is ready', () => {
    const store = new PluginStore()
    const config = { model: { expose: { value: true } }, name: 'reader' } satisfies PluginConfig

    store.markLoading('reader', config)
    expect(store.loading.get('reader')).toBe(config)
    expect(store.plugins.has('reader')).toBe(false)
    expect(store.modelEntries('expose')).toEqual([])

    store.markReady('reader')
    expect(store.loading.has('reader')).toBe(false)
    expect(store.plugins.get('reader')).toBe(config)
    expect(store.modelEntries('expose')).toEqual([['reader', { value: true }]])

    store.markUnloaded('reader')
    expect(store.plugins.has('reader')).toBe(false)
  })

  it('translates candidate display names and rejects invalid transitions', () => {
    const store = new PluginStore(value => `translated:${value}`)
    store.replaceCandidates([
      { ...candidate('reader', 'builtin'), manifest: manifest('reader', 'Reader') },
    ])

    expect(store.displayName('reader')).toBe('translated:Reader')
    expect(store.displayName('missing')).toBe('translated:missing')
    expect(() => store.markReady('missing')).toThrow('was not marked as loading')
  })
})

describe('plugin candidate providers', () => {
  it('reads internal definitions and honors disable preferences', async () => {
    const factory = () => ({ name: 'reader' })
    const preferences = {
      enabled: vi.fn(async (_plugin: string, fallback: boolean) => !fallback),
      setEnabled: vi.fn(async () => undefined),
    }
    const provider = new InternalPluginCandidateProvider(
      [
        { factory, manifest: manifest('reader'), enabledByDefault: true },
        { factory, manifest: manifest('core'), canDisable: false, enabledByDefault: false },
      ],
      preferences,
    )

    const candidates = await provider.list(new AbortController().signal)

    expect(candidates.map(item => [item.manifest.id, item.enabled])).toEqual([
      ['reader', false],
      ['core', true],
    ])
    expect(candidates[0].management).toEqual({
      canDisable: true,
      canUninstall: false,
      canUpdate: false,
    })
    expect((await candidates[0].load(new AbortController().signal)).factory).toBe(factory)
  })

  it('prefers builtins over installed candidates and rejects same-origin duplicates', async () => {
    const builtin = { id: 'builtin', list: async () => [candidate('reader', 'builtin')] }
    const installed = {
      id: 'installed',
      list: async () => [candidate('reader', 'installed'), candidate('other', 'installed')],
    }

    const result = await new CompositePluginCandidateProvider([installed, builtin]).list(
      new AbortController().signal,
    )
    expect(result.map(item => [item.manifest.id, item.origin])).toEqual([
      ['reader', 'builtin'],
      ['other', 'installed'],
    ])

    const duplicate = new CompositePluginCandidateProvider([
      { id: 'first', list: async () => [candidate('reader', 'installed')] },
      { id: 'second', list: async () => [candidate('reader', 'installed')] },
    ])
    await expect(duplicate.list(new AbortController().signal)).rejects.toThrow(
      'duplicate plugin candidate',
    )
  })
})