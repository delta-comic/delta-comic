import type { PluginArchiveDB } from '@delta-comic/db'
import { Logger } from '@delta-comic/logger'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  bootPlugin: vi.fn(async () => undefined),
  builtInConfigs: new Map<string, unknown>(),
  cleanupPlugin: vi.fn(),
  isBuiltInPlugin: vi.fn(() => false),
  loaders: [] as any[],
}))

vi.mock('@/features/registry', () => ({
  builtInPluginRegistry: {
    get: (name: string) =>
      mocks.builtInConfigs.has(name) ? { config: mocks.builtInConfigs.get(name) } : undefined,
  },
}))
vi.mock('@/i18n', () => ({
  pluginI18n: {
    translate: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  },
  pluginMessageKey: (key: string) => key,
}))
vi.mock('./booter', () => ({ bootPlugin: mocks.bootPlugin }))
vi.mock('./builtIn', () => ({ isBuiltInPlugin: mocks.isBuiltInPlugin }))
vi.mock('./cleanup', () => ({ cleanupPlugin: mocks.cleanupPlugin }))
vi.mock('./extensions', () => ({ runtimeExtensions: { loaders: { values: mocks.loaders } } }))
vi.mock('./init/storage', () => ({ isTauriRuntime: () => false }))

import {
  bootConfig,
  createPluginLoadingInfo,
  ensurePluginLoadingInfo,
  loadPlugin,
  loadPluginConfig,
  markPluginLoadError,
  type PluginLoadingInfo,
} from './loader'

const archive = (pluginName = 'fixture'): PluginArchiveDB.Archive =>
  ({
    loaderName: 'test-loader',
    meta: { require: [] },
    pluginName,
  }) as unknown as PluginArchiveDB.Archive

const createProgress = () => ref<Record<string, PluginLoadingInfo>>({})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.builtInConfigs.clear()
  mocks.isBuiltInPlugin.mockReturnValue(false)
  mocks.loaders.splice(0)
})

describe('plugin loader progress', () => {
  it('creates progress once and preserves existing steps', () => {
    const progress = createProgress()

    const first = ensurePluginLoadingInfo(progress, 'fixture')
    first.steps.push({ description: 'custom', name: 'custom' })
    const second = ensurePluginLoadingInfo(progress, 'fixture')

    expect(second).toEqual(first)
    expect(first).toEqual({
      progress: { status: 'wait', stepsIndex: 0 },
      steps: [
        {
          description: 'plugin.runtime.steps.waiting.description',
          name: 'plugin.runtime.steps.waiting.title',
        },
        { description: 'custom', name: 'custom' },
      ],
    })
    expect(createPluginLoadingInfo()).not.toBe(first)
  })

  it.each([
    [new Error('broken'), 'broken'],
    ['plain failure', 'plain failure'],
  ])('marks thrown values as a load error', (error, message) => {
    const progress = createProgress()

    markPluginLoadError(progress, 'fixture', error)

    expect(progress.value.fixture.progress).toMatchObject({ errorReason: message, status: 'error' })
  })
})

describe('plugin config booting', () => {
  it('boots a matching config and returns it', async () => {
    const progress = createProgress()
    const config = { name: 'fixture' }

    await expect(bootConfig(() => config, progress, { expectedName: 'fixture' })).resolves.toBe(
      config,
    )

    expect(mocks.bootPlugin).toHaveBeenCalledWith(config, progress)
  })

  it('rejects a name mismatch, records it, and rolls back the resolved config', async () => {
    const progress = createProgress()
    const rollback = vi.fn()
    const config = { name: 'unexpected' }

    await expect(
      bootConfig(() => config, progress, { expectedName: 'fixture', rollback }),
    ).rejects.toThrow('plugin name mismatch: fixture / unexpected')

    expect(rollback).toHaveBeenCalledWith(config, 'fixture')
    expect(progress.value.fixture.progress).toMatchObject({
      errorReason: 'plugin name mismatch: fixture / unexpected',
      status: 'error',
    })
  })

  it('preserves the boot error even if rollback also fails', async () => {
    const progress = createProgress()
    const consoleError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    mocks.bootPlugin.mockRejectedValueOnce(new Error('boot failed'))

    await expect(
      bootConfig(() => ({ name: 'fixture' }), progress, {
        expectedName: 'fixture',
        rollback: () => {
          throw new Error('rollback failed')
        },
      }),
    ).rejects.toThrow('boot failed')

    expect(consoleError).toHaveBeenCalledWith(
      'plugin boot rollback failed',
      { plugin: 'fixture' },
      expect.objectContaining({ message: 'rollback failed' }),
    )
  })
})

describe('plugin config resolution', () => {
  it('returns a built-in factory without invoking external loaders', async () => {
    const factory = () => ({ name: 'core' })
    mocks.isBuiltInPlugin.mockReturnValueOnce(true)
    mocks.builtInConfigs.set('core', factory)

    await expect(loadPluginConfig(archive('core'))).resolves.toBe(factory)
  })

  it('loads external factories through the named loader', async () => {
    const factory = () => ({ name: 'fixture' })
    const load = vi.fn(async () => factory)
    mocks.loaders.push({ load, name: 'test-loader' })
    const plugin = archive()

    await expect(loadPluginConfig(plugin)).resolves.toBe(factory)
    expect(load).toHaveBeenCalledExactlyOnceWith(plugin)
  })

  it('reports a missing named loader', async () => {
    await expect(loadPluginConfig(archive())).rejects.toThrow(
      'plugin.runtime.errors.loaderMissing:test-loader,fixture',
    )
  })
})

describe('complete plugin loading', () => {
  it('loads and boots an archive with the expected name', async () => {
    mocks.loaders.push({
      load: vi.fn(async () => () => ({ name: 'fixture' })),
      name: 'test-loader',
    })
    const progress = createProgress()

    await loadPlugin(archive(), progress)

    expect(mocks.bootPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fixture' }),
      progress,
    )
  })

  it('marks a missing default export and rolls back a placeholder config', async () => {
    mocks.loaders.push({ load: vi.fn(async () => undefined), name: 'test-loader' })
    const progress = createProgress()

    await expect(loadPlugin(archive(), progress)).rejects.toThrow(
      'plugin.runtime.errors.defaultExportMissing:fixture',
    )

    expect(progress.value.fixture.progress.status).toBe('error')
    expect(mocks.cleanupPlugin).not.toHaveBeenCalled()
  })

  it('cleans a resolved config when booting fails', async () => {
    mocks.loaders.push({
      load: vi.fn(async () => () => ({ name: 'fixture' })),
      name: 'test-loader',
    })
    mocks.bootPlugin.mockRejectedValueOnce(new Error('booter failed'))
    const progress = createProgress()

    await expect(loadPlugin(archive(), progress)).rejects.toThrow('booter failed')

    expect(mocks.cleanupPlugin).toHaveBeenCalledWith(expect.objectContaining({ name: 'fixture' }))
    expect(progress.value.fixture.progress).toMatchObject({
      errorReason: 'booter failed',
      status: 'error',
    })
  })
})