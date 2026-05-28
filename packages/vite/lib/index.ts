import type { PluginArchiveDB } from '@delta-comic/db'
import { extendsDepends } from '@delta-comic/utils'
import { merge } from 'es-toolkit'
import type { Plugin, PluginOption } from 'vite'
import { viteExternalsPlugin as external } from 'vite-plugin-externals'
import monkey from 'vite-plugin-monkey'

export const deltaComic = (
  meta: PluginArchiveDB.Meta,
  command: 'build' | 'serve',
): PluginOption => {
  const isServer = command == 'serve'
  const plugin: Plugin = {
    name: 'delta-comic-helper',
    config(config: any) {
      return merge(config, {
        build: {
          lib: {
            entry: './src/main.ts',
            fileName: 'index',
            cssFileName: 'index',
            name: `$$lib$$.__DcPlugin__${meta.name.id.replace('-', '_')}__`,
            formats: ['es'],
          },
        },
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(meta, null, 2),
      })
    },
  }
  return [
    external(
      Object.fromEntries(
        Object.entries(extendsDepends).map(([key, val]) => [key, val.split('.').slice(1)]),
      ),
      { disableInServe: false },
    ),
    ...(isServer
      ? [
          monkey({
            entry: meta.entry?.jsPath ?? 'src/main.ts',
            userscript: { description: JSON.stringify(meta) },
            build: { externalGlobals: isServer ? {} : extendsDepends },
            server: { mountGmApi: false, open: false, prefix: '[DEV] ' },
          }),
        ]
      : [plugin]),
  ]
}