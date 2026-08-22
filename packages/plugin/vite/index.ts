import type { PluginManifest } from '@delta-comic/model'
import { exposeHostLibraries, extendsDepends } from '@delta-comic/utils/vite'
import { merge } from 'es-toolkit'
import JSZip from 'jszip'
import type { Plugin, PluginOption } from 'vite'

import { createDevPlugin } from './dev'

export const deltaComic = (meta: PluginManifest): PluginOption[] => {
  const externalGlobals = extendsDepends as Record<string, string>
  let mode: string | undefined
  const sharedRuntimeGuard: Plugin = {
    name: 'delta-comic-shared-runtime-guard',
    enforce: 'pre',
    configResolved(config) {
      mode = config.mode
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
    config(config) {
      return merge(config, {
        build: {
          assetsInlineLimit: Number.POSITIVE_INFINITY,
          cssCodeSplit: false,
          lib: {
            entry: meta.entry?.jsPath ?? './src/main.ts',
            fileName: 'index',
            cssFileName: 'index',
            name: `$$lib$$.__DcPlugin__${meta.name.id.replace('-', '_')}__`,
            formats: ['es'],
          },
        },
      })
    },
    async generateBundle(_options, bundle) {
      const archiveName = 'plugin.zip'
      const manifest = JSON.stringify(meta, null, 2)
      const zip = new JSZip()

      for (const item of Object.values(bundle)) {
        if (item.fileName == archiveName) continue
        if (item.type == 'chunk') {
          zip.file(item.fileName, item.code)
          continue
        }
        zip.file(item.fileName, item.source)
      }

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