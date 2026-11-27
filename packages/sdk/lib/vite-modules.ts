import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import {
  hostModuleIds,
  modulePackage,
  isPublicSubpath,
  parseModuleManifest,
  type ModuleManifest,
} from '@delta-comic/platform/manifest'
import { init, parse } from 'es-module-lexer'
import JSZip from 'jszip'
import MagicString from 'magic-string'
import { dts } from 'rolldown-plugin-dts'
import type { Plugin } from 'vite-plus'
import { Rolldown } from 'vite-plus/pack'

export interface ModulePluginOptions extends Pick<
  ModuleManifest,
  'id' | 'name' | 'description' | 'icon' | 'author'
> {
  entry?: string
  exports?: Record<string, string>
  pluginPeers?: string[]
  supportCoreVersion?: string
}

async function localFile(root: string, path: string) {
  const absolute = await realpath(resolve(root, path))
  const local = relative(await realpath(root), absolute)
  if (isAbsolute(path) || local === '..' || local.startsWith('../') || isAbsolute(local))
    throw new Error(`expected a file inside the plugin: ${path}`)
  return absolute
}

export function modulePlugin({
  entry,
  exports: paths = {},
  pluginPeers = [],
  supportCoreVersion = '*',
  ...metadata
}: ModulePluginOptions): Plugin {
  let root: string
  let pkg: { name: string; version: string; peerDependencies?: Record<string, string> }
  let peers: Record<string, string>
  let entries: [string, string][]
  const external = (id: string) =>
    hostModuleIds.some(host => id === host) || pluginPeers.includes(modulePackage(id))
  const virtual = 'virtual:delta-comic/plugin'
  return {
    name: 'delta-comic:module-plugin',
    apply: 'build',
    enforce: 'post',
    async config(config) {
      root = await realpath(resolve(config.root ?? '.'))
      pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
      peers = Object.fromEntries(
        pluginPeers.toSorted().map(peer => {
          const range = pkg.peerDependencies?.[peer]
          if (!range) throw new Error(`${pkg.name}: missing peerDependencies range for ${peer}`)
          return [peer, range]
        }),
      )
      entries = await Promise.all(
        Object.keys(paths)
          .sort()
          .map(async (subpath): Promise<[string, string]> => {
            if (!isPublicSubpath(subpath)) throw new Error(`invalid public subpath: ${subpath}`)
            return [subpath, await localFile(root, paths[subpath])]
          }),
      )
      return {
        build: {
          lib: {
            entry: virtual,
            formats: ['cjs'],
            fileName: () => 'register.js',
            cssFileName: 'index',
          },
          cssCodeSplit: false,
          copyPublicDir: false,
          rolldownOptions: {
            external,
            output: {
              codeSplitting: false,
              dynamicImportInCjs: false,
              banner: `globalThis.__deltaComicRegister({package:${JSON.stringify(pkg.name)},factory(resolve){const __dcNamespaces=new WeakSet();function require(id){const ns=resolve(id);__dcNamespaces.add(ns);return ns}const module={exports:{}};(function(module,exports){`,
              footer: '})(module,module.exports);return module.exports}});',
            },
          },
        },
      }
    },
    resolveId(id) {
      if (id === virtual || id === resolve(root, virtual)) return '\0' + virtual
      if (
        !external(id) &&
        (id.startsWith('@vue/') || hostModuleIds.some(host => id.startsWith(host + '/')))
      )
        this.error(`unsupported host subpath: ${id}`)
    },
    async load(id) {
      if (id !== '\0' + virtual) return
      const imports = entries.map(
        ([, file], i) => `import * as ns${i} from ${JSON.stringify(file)}`,
      )
      const modules = entries.map(([path], i) => `[${JSON.stringify(path)}]:ns${i}`)
      if (entry)
        imports.push(`import components from ${JSON.stringify(await localFile(root, entry))}`)
      else imports.push('const components=[]')
      return [...imports, `export {components};export const modules={${modules.join(',')}}`].join(
        '\n',
      )
    },
    async transform(code, id) {
      // Rolldown applies Node default interop even to an external ESM namespace.
      // Only bypass that conversion for objects returned by the host's resolver.
      if (id === Rolldown.RUNTIME_MODULE_ID) {
        const declaration = 'export var __toESM ='
        const start = code.indexOf(declaration)
        if (start < 0) this.error('unsupported Rolldown interop helper')
        const output = new MagicString(code)
        output.overwrite(start, start + declaration.length, 'var __dcToESM =')
        output.append(
          '\nexport var __toESM = (mod, mode) => __dcNamespaces.has(mod) ? mod : __dcToESM(mod, mode);',
        )
        return { code: output.toString(), map: output.generateMap({ hires: true }) }
      }
      if (!code.includes('import') || id.endsWith('.css')) return
      await init
      const [imports] = parse(code)
      for (const item of imports) {
        if (
          item.type === 'dynamic' &&
          (!item.specifier || (external(item.specifier) && item.attributesStart >= 0))
        )
          this.error(
            'dynamic import requires a literal module id and no external import attributes',
            item.importStart,
          )
      }
    },
    async generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk')
      const script = chunks[0]
      if (chunks.length !== 1 || !script?.isEntry) this.error('expected one registration script')
      const zip = new JSZip()
      const resources: ModuleManifest['resources'] = []
      const add = (path: string, source: string | Uint8Array, mimeType: string) => {
        zip.file(path, source)
        resources.push({
          path,
          mimeType,
          integrity: 'sha256-' + createHash('sha256').update(source).digest('base64'),
        })
      }
      for (const file of Object.values(bundle)) {
        add(
          file.fileName,
          file.type === 'chunk' ? file.code : file.source,
          file.type === 'chunk'
            ? 'application/javascript'
            : file.fileName.endsWith('.css')
              ? 'text/css'
              : 'application/octet-stream',
        )
      }
      if (metadata.icon && !/^https?:\/\//i.test(metadata.icon) && !bundle[metadata.icon]) {
        const source = await readFile(await localFile(root, metadata.icon))
        this.emitFile({ type: 'asset', fileName: metadata.icon, source })
        add(metadata.icon, source, 'application/octet-stream')
      }
      if (entries.length) {
        const declarations = await Rolldown.rolldown({
          cwd: root,
          input: Object.fromEntries(
            entries.map(([path, file]) => [path === '.' ? 'index' : path.slice(2), file]),
          ),
          external: id => !id.startsWith('.') && !isAbsolute(id) && !id.startsWith('\0'),
          plugins: [dts({ cwd: root, dtsOnly: true, generator: 'tsc' })],
        })
        try {
          const { output } = await declarations.generate({ format: 'es' })
          for (const file of output) {
            this.emitFile({
              type: 'asset',
              fileName: file.fileName,
              source: file.type === 'chunk' ? file.code : file.source,
            })
          }
        } finally {
          await declarations.close()
        }
      }
      const manifest = parseModuleManifest({
        formatVersion: 2,
        ...metadata,
        package: pkg.name,
        version: pkg.version,
        supportCoreVersion,
        script: script.fileName,
        exports: entries.map(([path]) => path),
        externals: [...new Set([...script.imports, ...script.dynamicImports])].sort(),
        pluginPeers: peers,
        resources: resources.sort((a, b) => (a.path < b.path ? -1 : Number(a.path > b.path))),
      })
      const source = JSON.stringify(manifest, null, 2)
      zip.file('manifest.json', source)
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source })
      this.emitFile({
        type: 'asset',
        fileName: 'plugin.zip',
        source: await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
      })
    },
  }
}