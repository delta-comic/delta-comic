import type { PluginArchiveDB } from '@delta-comic/db'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => {
  const installers: any[] = []
  const loaders: any[] = []
  return {
    createDownloadMessage: vi.fn(async (_title: string, action: (message: any) => unknown) => {
      const message = {
        createLoading: vi.fn(async (_label: string, callback: (value: any) => unknown) =>
          callback({ description: '', progress: undefined, retryable: false }),
        ),
        createProgress: vi.fn(async (_label: string, callback: (value: any) => unknown) =>
          callback({ description: '', progress: undefined, retryable: false }),
        ),
      }
      return action(message)
    }),
    installers,
    installOverride: [] as { key: string; value: string }[],
    installedNames: [] as string[],
    isBuiltInPlugin: vi.fn(() => false),
    isBuiltInPluginName: vi.fn((name: string) => name === 'core'),
    loaders,
    runtimeUninstall: vi.fn(async () => undefined),
    upsertArchives: vi.fn(async () => undefined),
  }
})

vi.mock('@delta-comic/db', () => ({
  PluginArchiveDB: {},
  db: {
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        execute: vi.fn(async () => mocks.installedNames.map(pluginName => ({ pluginName }))),
      })),
    })),
  },
}))
vi.mock('@delta-comic/ui', () => ({ createDownloadMessage: mocks.createDownloadMessage }))
vi.mock('@/config', () => ({
  useConfig: () => ({
    $loadApp: () => ({ data: { value: { installOverride: mocks.installOverride } } }),
  }),
}))
vi.mock('@/i18n', () => ({
  pluginI18n: {
    translate: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  },
}))
vi.mock('./builtIn', () => ({
  isBuiltInPlugin: mocks.isBuiltInPlugin,
  isBuiltInPluginName: mocks.isBuiltInPluginName,
}))
vi.mock('./extensions', () => ({ runtimeExtensions: { installers: { values: mocks.installers } } }))
vi.mock('./loader', () => ({ loaders: mocks.loaders }))
vi.mock('./runtime', () => ({ pluginRuntime: { uninstall: mocks.runtimeUninstall } }))
vi.mock('./store', () => ({ pluginStore: { $upsertArchives: mocks.upsertArchives } }))

const meta = (
  id: string,
  require: { download?: string; id: string }[] = [],
): PluginArchiveDB.Meta =>
  ({
    author: 'test',
    description: 'installer fixture',
    icon: 'assets/icon.png',
    name: { display: `Display ${id}`, id },
    require,
    version: { plugin: '1.0.0', supportCore: '*' },
  }) as PluginArchiveDB.Meta

const archive = (pluginName = 'fixture'): PluginArchiveDB.Archive =>
  ({
    displayName: pluginName,
    enable: true,
    installInput: 'gh:owner/repo',
    installerName: 'github',
    loaderName: 'zip',
    meta: meta(pluginName),
    pluginName,
  }) as PluginArchiveDB.Archive

beforeEach(() => {
  vi.clearAllMocks()
  mocks.installers.splice(0)
  mocks.loaders.splice(0)
  mocks.installOverride = []
  mocks.installedNames = []
  mocks.isBuiltInPlugin.mockReturnValue(false)
})

describe('plugin installation orchestration', () => {
  it('follows downloader redirects, clamps loader progress, and persists the archive', async () => {
    const file = new File(['zip'], 'plugin.zip')
    const redirect = {
      download: vi.fn(async () => 'direct:https://example.test/plugin.zip'),
      isMatched: (input: string) => input.startsWith('gh:'),
      name: 'github',
    }
    const direct = {
      download: vi.fn(async () => file),
      isMatched: (input: string) => input.startsWith('direct:'),
      name: 'direct',
    }
    const progressValues: number[] = []
    const loader = {
      canInstall: (candidate: File) => candidate === file,
      install: vi.fn(async (_file: File, context: any) => {
        context.report({ description: 'extracting', progress: -10 })
        progressValues.push(-10)
        context.report({ progress: 120 })
        progressValues.push(120)
        return meta('fixture')
      }),
      name: 'zip',
    }
    mocks.installers.push(redirect, direct)
    mocks.loaders.push(loader)
    const { installPlugin } = await import('./install')

    await installPlugin('gh:owner/repo', new Set())

    expect(redirect.download).toHaveBeenCalledWith('gh:owner/repo')
    expect(direct.download).toHaveBeenCalledWith('direct:https://example.test/plugin.zip')
    expect(loader.install).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ report: expect.any(Function) }),
    )
    expect(progressValues).toEqual([-10, 120])
    expect(mocks.upsertArchives).toHaveBeenCalledWith([
      expect.objectContaining({
        displayName: 'Display fixture',
        enable: true,
        installInput: 'gh:owner/repo',
        installerName: 'direct',
        loaderName: 'zip',
        meta: expect.objectContaining({ icon: 'assets/icon.png' }),
        pluginName: 'fixture',
      }),
    ])
  })

  it('installs only missing downloadable dependencies and honors app overrides', async () => {
    const dependencyFile = new File(['dependency'], 'dependency.zip')
    const downloader = {
      download: vi.fn(async () => dependencyFile),
      isMatched: (input: string) => input === 'override:dep',
      name: 'direct',
    }
    mocks.installers.push(downloader)
    mocks.loaders.push({
      canInstall: () => true,
      install: vi.fn(async () => meta('dep')),
      name: 'zip',
    })
    mocks.installOverride = [{ key: 'dep', value: 'override:dep' }]
    const message = {
      createLoading: async (_label: string, action: (value: any) => unknown) =>
        action({ description: '', retryable: false }),
    }
    const { installDepends } = await import('./install')

    await installDepends(
      message as never,
      meta('parent', [
        { download: 'original:dep', id: 'dep' },
        { download: 'skip:installed', id: 'installed' },
        { id: 'manual' },
      ]),
      new Set(['installed']),
    )

    expect(downloader.download).toHaveBeenCalledExactlyOnceWith('override:dep')
    expect(mocks.upsertArchives).toHaveBeenCalledOnce()
  })

  it('rejects unknown download handlers, unknown loaders, and reserved plugin ids', async () => {
    const { installFilePlugin, installPlugin } = await import('./install')
    await expect(installPlugin('unknown:plugin')).rejects.toThrow(
      'plugin.install.errors.noDownloader',
    )

    await expect(installFilePlugin(new File([], 'plugin.bin'))).rejects.toThrow(
      'plugin.install.errors.noInstaller',
    )

    mocks.loaders.push({
      canInstall: () => true,
      install: vi.fn(async () => meta('core')),
      name: 'zip',
    })
    await expect(installFilePlugin(new File([], 'core.zip'))).rejects.toThrow(
      'plugin.install.errors.reservedId',
    )
    expect(mocks.upsertArchives).not.toHaveBeenCalled()
  })
})

describe('plugin updates and removal', () => {
  it('updates through a redirected installer and the archive loader', async () => {
    const plugin = archive()
    const file = new File(['next'], 'next.zip')
    mocks.installers.push(
      { name: 'github', update: vi.fn(async () => 'direct') },
      { name: 'direct', update: vi.fn(async () => file) },
    )
    const nextMeta = meta('fixture')
    const loader = {
      install: vi.fn(async (_file: File, context: any) => {
        context.report({ description: 'writing', progress: 150 })
        return nextMeta
      }),
      name: 'zip',
    }
    mocks.loaders.push(loader)
    const { updatePlugin } = await import('./install')

    await updatePlugin(plugin, new Set(['dependency']))

    expect(mocks.installers[0].update).toHaveBeenCalledWith(plugin)
    expect(mocks.installers[1].update).toHaveBeenCalledWith(plugin)
    expect(loader.install).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ report: expect.any(Function) }),
    )
    expect(mocks.upsertArchives).toHaveBeenCalledWith([{ ...plugin, meta: nextMeta }])
  })

  it('rejects built-in updates and missing update handlers', async () => {
    const { updatePlugin } = await import('./install')
    mocks.isBuiltInPlugin.mockReturnValueOnce(true)
    await expect(updatePlugin(archive('core'))).rejects.toThrow(
      'plugin.install.errors.builtInUpdate',
    )

    await expect(updatePlugin(archive())).rejects.toThrow('plugin.install.errors.noDownloader')
  })

  it('rejects an update when its persisted loader no longer exists', async () => {
    const file = new File(['next'], 'next.zip')
    mocks.installers.push({ name: 'github', update: vi.fn(async () => file) })
    const { updatePlugin } = await import('./install')

    await expect(updatePlugin(archive())).rejects.toThrow('plugin.install.errors.noInstaller')
  })

  it('delegates uninstall to the runtime', async () => {
    const { uninstallPlugin } = await import('./install')

    await uninstallPlugin('fixture')

    expect(mocks.runtimeUninstall).toHaveBeenCalledExactlyOnceWith('fixture')
  })
})