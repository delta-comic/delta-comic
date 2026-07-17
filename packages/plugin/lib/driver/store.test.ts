import type { PluginArchiveDB } from '@delta-comic/db'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  executeNames: vi.fn(async () => [] as { displayName: string; pluginName: string }[]),
  replaceExecute: vi.fn(async () => undefined),
  replaceValues: vi.fn(),
  translate: vi.fn((value: string) => `translated:${value}`),
}))

vi.mock('@delta-comic/db', () => ({
  db: {
    replaceInto: vi.fn(() => ({
      values: (values: unknown) => {
        mocks.replaceValues(values)
        return { execute: mocks.replaceExecute }
      },
    })),
    selectFrom: vi.fn(() => ({ select: vi.fn(() => ({ execute: mocks.executeNames })) })),
  },
}))
vi.mock('@/i18n', () => ({ translatePluginText: mocks.translate }))

import { PluginStore } from './store'

const archive = {
  displayName: 'Fixture',
  enable: true,
  installInput: '',
  installerName: '',
  loaderName: 'test',
  meta: {
    author: 'Delta Comic',
    description: 'Fixture plugin',
    icon: 'assets/icon.png',
    name: { display: 'Fixture', id: 'fixture' },
    require: [],
    version: { plugin: '1.0.0', supportCore: '*' },
  },
  pluginName: 'fixture',
} as PluginArchiveDB.Archive

beforeEach(() => {
  vi.clearAllMocks()
})

describe('plugin store', () => {
  it('refreshes display names atomically and falls back to the plugin key', async () => {
    const store = new PluginStore()
    mocks.executeNames.mockResolvedValueOnce([
      { displayName: 'Fixture name', pluginName: 'fixture' },
    ])

    await store.$refreshI18nNames()

    expect(store.$getI18nName('fixture')).toBe('translated:Fixture name')
    expect(store.$getI18nName('missing')).toBe('translated:missing')
  })

  it('serializes metadata, refreshes names, and advances the revision after upsert', async () => {
    const store = new PluginStore()

    await store.$upsertArchives([archive])

    expect(mocks.replaceValues).toHaveBeenCalledWith([
      expect.objectContaining({ meta: JSON.stringify(archive.meta), pluginName: 'fixture' }),
    ])
    expect(mocks.replaceExecute).toHaveBeenCalledOnce()
    expect(mocks.executeNames).toHaveBeenCalledOnce()
    expect(store.revision.value).toBe(1)
  })

  it('does not touch persistence or revision for an empty batch', async () => {
    const store = new PluginStore()

    await store.$upsertArchives([])

    expect(mocks.replaceValues).not.toHaveBeenCalled()
    expect(store.revision.value).toBe(0)
    store.$touch()
    expect(store.revision.value).toBe(1)
  })
})