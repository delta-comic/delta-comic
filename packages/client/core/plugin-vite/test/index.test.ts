import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { PluginArchiveDB } from '@delta-comic/client-data-db'
import JSZip from 'jszip'
import { describe, expect, it } from 'vite-plus/test'

import { deltaComic } from '../lib/plugin'

const meta: PluginArchiveDB.Meta = {
  protocolVersion: 2,
  client: { entry: 'index.js' },
  resources: [],
  name: 'Test Plugin',
  id: 'test-plugin',
  version: '1.0.0',
  author: 'delta',
  description: 'test plugin',
  icon: 'assets/icon.svg',
}

type TestAssetSource = string | Uint8Array

type TestEmittedFile = { fileName: string; source: TestAssetSource; type: 'asset' }

type TestBundleItem =
  | { type: 'asset'; fileName: string; source: TestAssetSource }
  | {
      type: 'chunk'
      fileName: string
      code: string
      imports: string[]
      dynamicImports: string[]
      isEntry: boolean
    }

type TestOutputBundle = Record<string, TestBundleItem>

type TestPluginContext = { emitFile(file: TestEmittedFile): unknown }
type TestTransformContext = { error(message: string): never }

type TestDeltaComicPlugin = {
  name: string
  enforce?: 'post' | 'pre'
  apply?: 'build' | 'serve'
  configResolved?(config: { mode: string; root?: string }): void
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

const getBuildPlugin = (manifest = meta): TestDeltaComicPlugin => {
  const plugin = deltaComic(manifest).flat() as unknown[]
  const buildPlugin = plugin.find(isDeltaComicPlugin)
  if (!buildPlugin) throw new Error('delta-comic-helper not found')
  return buildPlugin
}

const getSharedRuntimeGuard = (): TestDeltaComicPlugin => {
  const plugins = deltaComic(meta).flat() as unknown[]
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
  const plugins = deltaComic(meta).flat() as unknown[]
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
  it('packages paired and server-only flow entries with integrity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dc-plugin-build-'))
    const flow = JSON.stringify({ version: 1, flows: [] })
    await writeFile(join(root, 'flows.json'), flow)
    try {
      for (const client of [meta.client, undefined]) {
        const plugin = getBuildPlugin({
          ...meta,
          icon: undefined,
          client,
          server: { entry: 'flows.json' },
        })
        plugin.configResolved?.({ mode: 'production', root })
        const emitted: TestEmittedFile[] = []
        const bundle: TestOutputBundle = {
          'index.js': {
            type: 'chunk',
            fileName: 'index.js',
            code: 'export default []',
            imports: [],
            dynamicImports: [],
            isEntry: true,
          },
        }
        await plugin.generateBundle?.call({ emitFile: file => emitted.push(file) }, {}, bundle)
        const archive = emitted.find(file => file.fileName === 'plugin.zip')
        if (!archive) throw new Error('archive missing')
        const zip = await JSZip.loadAsync(archive.source)
        expect(await zip.file('flows.json')?.async('string')).toBe(flow)
        const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
        expect(manifest.server).toEqual({ entry: 'flows.json' })
        expect(manifest.resources).toContainEqual(
          expect.objectContaining({
            path: 'flows.json',
            integrity: expect.stringMatching(/^sha256-/),
          }),
        )
        expect(Boolean(manifest.client)).toBe(Boolean(client))
        expect(plugin.config?.({}).build.lib.entry).toBe(
          client ? './src/main.ts' : 'virtual:delta-comic-server',
        )
      }
    } finally {
      await rm(root, { recursive: true })
    }
  })
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

  it('skips shared runtime checks in test mode', () => {
    const guard = getSharedRuntimeGuard()
    guard.configResolved?.({ mode: 'test' })

    expect(guard.resolveId?.('vue/dist/vue.esm-bundler.js')).toBeUndefined()
    expect(guard.resolveId?.('@vue/runtime-core')).toBeUndefined()
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
      `import { createApp } from 'vue'\nconst db = import('@delta-comic/client-data-db')`,
      '\0virtual:plugin-entry',
    )

    expect(result?.code).toContain('const createApp = window.$$lib$$.Vue.createApp')
    expect(result?.code).toContain('Promise.resolve(window.$$lib$$.DcDb)')
  })

  it('uses fixed source and output entry paths while retaining code splitting', () => {
    const config = getBuildPlugin().config?.({})

    expect(config.build.lib.entry).toBe('./src/main.ts')
    expect(config.build.lib.fileName).toBe('index')
    expect(config.build.lib.cssFileName).toBe('index')
    expect(config.build.assetsInlineLimit).toBe(Number.POSITIVE_INFINITY)
    expect(config.build.cssCodeSplit).toBe(false)
    expect(config.build.rollupOptions).toBeUndefined()
    expect(config.build.rolldownOptions).toBeUndefined()
  })

  it('emits plugin.zip and keeps manifest.json outside the archive', async () => {
    const plugin = getBuildPlugin()
    const emitted: TestEmittedFile[] = []
    const bundle = {
      'index.js': {
        type: 'chunk',
        fileName: 'index.js',
        code: 'export default []',
        imports: [],
        dynamicImports: [],
        isEntry: true,
      },
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

    const archiveFile = emitted.find(file => file.fileName == 'plugin.zip')
    const manifestFile = emitted.find(file => file.fileName == 'manifest.json')

    expect(plugin.enforce).toBe('post')
    expect(plugin.apply).toBe('build')
    expect(archiveFile?.source).toBeInstanceOf(Uint8Array)
    expect(typeof manifestFile?.source).toBe('string')
    if (typeof manifestFile?.source !== 'string') throw new Error('manifest not emitted')
    const manifest = manifestFile.source
    expect(JSON.parse(manifest)).toMatchObject({
      protocolVersion: 2,
      client: { entry: 'index.js' },
      resources: [
        { path: 'index.js', integrity: expect.stringMatching(/^sha256-/) },
        { path: 'index.css', mimeType: 'text/css' },
        { path: 'assets/icon.svg' },
      ],
    })

    const zip = await JSZip.loadAsync(archiveFile?.source as Uint8Array)
    await expect(zip.file('manifest.json')?.async('string')).resolves.toBe(manifest)
    await expect(zip.file('index.js')?.async('string')).resolves.toBe('export default []')
    await expect(zip.file('index.css')?.async('string')).resolves.toBe('body{}')
    await expect(zip.file('assets/icon.svg')?.async('string')).resolves.toBe('<svg></svg>')
  })
})