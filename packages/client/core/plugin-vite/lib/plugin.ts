import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import type { PluginManifest } from '@delta-comic/model'
import { exposeHostLibraries, extendsDepends } from '@delta-comic/utils/vite'
import JSZip from 'jszip'
import type { Plugin, PluginOption } from 'vite-plus'

import { createDevPlugin } from './dev'

export const deltaComic = (meta: PluginManifest): PluginOption[] => {
  const externalGlobals = extendsDepends as Record<string, string>
  let mode: string | undefined
  let root = process.cwd()
  const sharedRuntimeGuard: Plugin = {
    name: 'delta-comic-shared-runtime-guard',
    enforce: 'pre',
    configResolved(config) {
      mode = config.mode
      root = config.root
    },
    resolveId(source) {
      if (mode == 'test') return

      if (Object.hasOwn(externalGlobals, source)) return

      const externalRoot = Object.keys(externalGlobals).find(root => source.startsWith(`${root}/`))
      if (!externalRoot && !source.startsWith('@vue/')) return

      const publicEntry = externalRoot ?? 'vue'
      throw new Error(
        `[delta-comic] Shared runtime subpath "${source}" is not supported. Import "${publicEntry}" so the plugin reuses the host instance.`,
      )
    },
  }
  const plugin: Plugin = {
    name: 'delta-comic-helper',
    enforce: 'post',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    resolveId(id) {
      if (id === 'virtual:delta-comic-server') return '\0delta-comic-server'
    },
    load(id) {
      if (id === '\0delta-comic-server') return 'export {}'
    },
    config() {
      return {
        build: {
          assetsInlineLimit: Number.POSITIVE_INFINITY,
          cssCodeSplit: false,
          lib: {
            entry: meta.client ? './src/main.ts' : 'virtual:delta-comic-server',
            fileName: 'index',
            cssFileName: 'index',
            name: `$$lib$$.__DcPlugin__${meta.id.replaceAll('-', '_')}__`,
            formats: ['es'],
          },
        },
      }
    },
    async generateBundle(_options, bundle) {
      const archiveName = 'plugin.zip'
      const zip = new JSZip()
      const resources: PluginManifest['resources'] = []

      for (const item of Object.values(bundle)) {
        if (item.fileName == archiveName) continue
        if (!meta.client && item.type === 'chunk') {
          delete bundle[item.fileName]
          continue
        }
        const source = item.type === 'chunk' ? item.code : item.source
        zip.file(item.fileName, source)
        const mimeType =
          item.type === 'chunk'
            ? 'application/javascript'
            : item.fileName.endsWith('.css')
              ? 'text/css'
              : item.fileName.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream'
        resources.push({
          path: item.fileName,
          mimeType,
          integrity: `sha256-${createHash('sha256').update(source).digest('base64')}`,
          imports:
            item.type === 'chunk'
              ? [...item.imports, ...item.dynamicImports].filter(path => path in bundle)
              : [],
        })
      }
      const assets = [
        meta.server?.entry,
        meta.icon && !/^https?:\/\//i.test(meta.icon) ? meta.icon : undefined,
      ]
      for (const path of assets) {
        if (!path || resources.some(resource => resource.path === path)) continue
        const absolute = resolve(root, path)
        const local = relative(root, absolute)
        if (isAbsolute(path) || local.startsWith('..') || path.includes('\\'))
          throw new Error(`invalid plugin asset path: ${path}`)
        const source = await readFile(absolute)
        this.emitFile({ type: 'asset', fileName: path, source })
        zip.file(path, source)
        resources.push({
          path,
          mimeType: path.endsWith('.json') ? 'application/json' : 'application/octet-stream',
          integrity: `sha256-${createHash('sha256').update(source).digest('base64')}`,
          imports: [],
        })
      }
      const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry)
      const manifest = JSON.stringify(
        {
          ...meta,
          resources,
          ...(meta.client && entry ? { client: { entry: entry.fileName } } : {}),
        },
        null,
        2,
      )
      zip.file('manifest.json', manifest)
      const archive = await zip.generateAsync({ compression: 'DEFLATE', type: 'uint8array' })

      this.emitFile({ type: 'asset', fileName: archiveName, source: archive })
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: manifest })
    },
  }
  const externals = exposeHostLibraries({ libraries: externalGlobals })
  const devPlugin = createDevPlugin(meta)
  devPlugin.apply = 'serve'

  return [sharedRuntimeGuard, externals, plugin, devPlugin]
}