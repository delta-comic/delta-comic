import type { PluginArchiveDB } from '@delta-comic/db'
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vite-plus/test'

import { deltaComic } from './index'

vi.mock('vite-plugin-monkey', () => ({ default: () => ({ name: 'vite-plugin-monkey' }) }))

const meta: PluginArchiveDB.Meta = {
  name: { display: 'Test Plugin', id: 'test-plugin' },
  version: { plugin: '1.0.0', supportCore: '1.0.0' },
  author: 'delta',
  description: 'test plugin',
  icon: 'assets/icon.svg',
  require: [],
  entry: { jsPath: 'index.mjs', cssPath: 'index.css' },
}

type TestAssetSource = string | Uint8Array

type TestEmittedFile = { fileName: string; source: TestAssetSource; type: 'asset' }

type TestBundleItem =
  | { type: 'asset'; fileName: string; source: TestAssetSource }
  | { type: 'chunk'; fileName: string; code: string }

type TestOutputBundle = Record<string, TestBundleItem>

type TestPluginContext = { emitFile(file: TestEmittedFile): unknown }
type TestTransformContext = { error(message: string): never }

type TestDeltaComicPlugin = {
  name: string
  enforce?: 'post' | 'pre'
  config?(config: unknown): any
  resolveId?(source: string): void
  transform?(
    this: TestTransformContext,
    code: string,
    id: string,
  ): Promise<{ code: string } | undefined>
  generateBundle?(
    this: TestPluginContext,
    options: unknown,
    bundle: TestOutputBundle,
  ): void | Promise<void>
}

const isDeltaComicPlugin = (plugin: unknown): plugin is TestDeltaComicPlugin =>
  Boolean(plugin) &&
  typeof plugin == 'object' &&
  (plugin as { name?: unknown }).name == 'delta-comic-helper'

const getBuildPlugin = (): TestDeltaComicPlugin => {
  const plugin = deltaComic(meta, 'build').flat() as unknown[]
  const buildPlugin = plugin.find(isDeltaComicPlugin)
  if (!buildPlugin) throw new Error('delta-comic-helper not found')
  return buildPlugin
}

const getSharedRuntimeGuard = (): TestDeltaComicPlugin => {
  const plugins = deltaComic(meta, 'build').flat() as unknown[]
  const guard = plugins.find(
    plugin =>
      Boolean(plugin) &&
      typeof plugin == 'object' &&
      (plugin as { name?: unknown }).name == 'delta-comic-shared-runtime-guard',
  ) as TestDeltaComicPlugin | undefined
  if (!guard) throw new Error('delta-comic-shared-runtime-guard not found')
  return guard
}

const getSharedRuntimeExternals = (): TestDeltaComicPlugin => {
  const plugins = deltaComic(meta, 'build').flat() as unknown[]
  const externals = plugins.find(
    plugin =>
      Boolean(plugin) &&
      typeof plugin == 'object' &&
      (plugin as { name?: unknown }).name == 'delta-comic:shared-runtime-externals',
  ) as TestDeltaComicPlugin | undefined
  if (!externals) throw new Error('delta-comic:shared-runtime-externals not found')
  return externals
}

describe('deltaComic vite plugin', () => {
  it('rejects shared runtime subpaths that would bypass host externals', () => {
    const guard = getSharedRuntimeGuard()

    expect(guard.resolveId?.('vue')).toBeUndefined()
    expect(() => guard.resolveId?.('vue/dist/vue.esm-bundler.js')).toThrow(
      'Import "vue" so the plugin reuses the host instance',
    )
    expect(guard.resolveId?.('vue-router/experimental')).toBeUndefined()
    expect(() => guard.resolveId?.('vue-router/auto-routes')).toThrow(
      'Import "vue-router" so the plugin reuses the host instance',
    )
    expect(() => guard.resolveId?.('@vue/runtime-core')).toThrow(
      'Import "vue" so the plugin reuses the host instance',
    )
  })

  it('rewrites plugin static and dynamic imports to the host ABI', async () => {
    const externals = getSharedRuntimeExternals()
    const context: TestTransformContext = {
      error(message): never {
        throw new Error(message)
      },
    }
    const result = await externals.transform?.call(
      context,
      `import { createApp } from 'vue'\nconst db = import('@delta-comic/db')`,
      '\0virtual:plugin-entry',
    )

    expect(result?.code).toContain('const createApp = window.$$lib$$.Vue.createApp')
    expect(result?.code).toContain('Promise.resolve(window.$$lib$$.DcDb)')
  })

  it('forces a browser-safe single-file bundle with inlined assets', () => {
    const config = getBuildPlugin().config?.({})

    expect(config.build.assetsInlineLimit).toBe(Number.POSITIVE_INFINITY)
    expect(config.build.cssCodeSplit).toBe(false)
    expect(config.build.rollupOptions.output.inlineDynamicImports).toBe(true)
  })

  it('emits plugin.zip and keeps manifest.json outside the archive', async () => {
    const plugin = getBuildPlugin()
    const emitted: TestEmittedFile[] = []
    const bundle = {
      'index.mjs': { type: 'chunk', fileName: 'index.mjs', code: 'export default 1' },
      'index.css': { type: 'asset', fileName: 'index.css', source: 'body{}' },
      'assets/icon.svg': { type: 'asset', fileName: 'assets/icon.svg', source: '<svg></svg>' },
    } satisfies TestOutputBundle
    const context: TestPluginContext = {
      emitFile(file) {
        emitted.push(file)
        return file.fileName
      },
    }

    await plugin.generateBundle?.call(context, {}, bundle)

    const manifest = JSON.stringify(meta, null, 2)
    const archiveFile = emitted.find(file => file.fileName == 'plugin.zip')
    const manifestFile = emitted.find(file => file.fileName == 'manifest.json')

    expect(plugin.enforce).toBe('post')
    expect(archiveFile?.source).toBeInstanceOf(Uint8Array)
    expect(manifestFile?.source).toBe(manifest)

    const zip = await JSZip.loadAsync(archiveFile?.source as Uint8Array)
    await expect(zip.file('manifest.json')?.async('string')).resolves.toBe(manifest)
    await expect(zip.file('index.mjs')?.async('string')).resolves.toBe('export default 1')
    await expect(zip.file('index.css')?.async('string')).resolves.toBe('body{}')
    await expect(zip.file('assets/icon.svg')?.async('string')).resolves.toBe('<svg></svg>')
  })
})