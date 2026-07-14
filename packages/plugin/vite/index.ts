import type { PluginArchiveDB } from '@delta-comic/db'
import { extendsDepends } from '@delta-comic/utils/vite'
import { merge } from 'es-toolkit'
import JSZip from 'jszip'
import { viteExternalsPlugin as external } from 'vite-plugin-externals'
import monkey from 'vite-plugin-monkey'

type DeltaComicBundleAssetSource = string | Uint8Array

type DeltaComicPluginContext = {
  emitFile(file: { type: 'asset'; fileName: string; source: DeltaComicBundleAssetSource }): unknown
}

type DeltaComicBundleItem =
  | { type: 'asset'; fileName: string; source: DeltaComicBundleAssetSource }
  | { type: 'chunk'; fileName: string; code: string }

type DeltaComicOutputBundle = Record<string, DeltaComicBundleItem>

type DeltaComicPlugin = {
  name: string
  enforce?: 'post' | 'pre'
  config?(config: unknown): unknown
  resolveId?(source: string): void
  generateBundle?(
    this: DeltaComicPluginContext,
    options: unknown,
    bundle: DeltaComicOutputBundle,
  ): void | Promise<void>
}

type DeltaComicPluginOption = DeltaComicPlugin | DeltaComicPluginOption[] | false | null | undefined

export const deltaComic = (
  meta: PluginArchiveDB.Meta,
  command: 'build' | 'serve',
): DeltaComicPluginOption[] => {
  const externalGlobals = extendsDepends as Record<string, string>
  const isServer = command == 'serve'
  const sharedRuntimeGuard: DeltaComicPlugin = {
    name: 'delta-comic-shared-runtime-guard',
    enforce: 'pre',
    resolveId(source) {
      const externalRoot = Object.keys(externalGlobals).find(root => source.startsWith(`${root}/`))
      if (!externalRoot && !source.startsWith('@vue/')) return

      const publicEntry = externalRoot ?? 'vue'
      throw new Error(
        `[delta-comic] Shared runtime subpath "${source}" is not supported. Import "${publicEntry}" so the plugin reuses the host instance.`,
      )
    },
  }
  const plugin: DeltaComicPlugin = {
    name: 'delta-comic-helper',
    enforce: 'post',
    config(config: any) {
      return merge(config, {
        build: {
          assetsInlineLimit: Number.POSITIVE_INFINITY,
          cssCodeSplit: false,
          lib: {
            entry: './src/main.ts',
            fileName: 'index',
            cssFileName: 'index',
            name: `$$lib$$.__DcPlugin__${meta.name.id.replace('-', '_')}__`,
            formats: ['es'],
          },
          rollupOptions: { output: { inlineDynamicImports: true } },
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
  const externals = external(
    Object.fromEntries(
      Object.entries(externalGlobals).map(([key, val]) => [key, val.split('.').slice(1)]),
    ),
    { disableInServe: false },
  ) as DeltaComicPluginOption

  return [
    sharedRuntimeGuard,
    externals,
    ...(isServer
      ? [
          monkey({
            entry: meta.entry?.jsPath ?? 'src/main.ts',
            userscript: { description: JSON.stringify(meta) },
            build: { externalGlobals: isServer ? {} : externalGlobals },
            server: { mountGmApi: false, open: false, prefix: '[DEV] ' },
          }) as DeltaComicPluginOption,
        ]
      : [plugin]),
  ]
}