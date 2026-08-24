import type { IncomingMessage, ServerResponse } from 'node:http'
import { relative, resolve } from 'node:path'

import type { PluginManifest } from '@delta-comic/model'
import type { Connect, ModuleNode, Plugin, ViteDevServer } from 'vite'
import { isCSSRequest, normalizePath } from 'vite'

import { DEV_CSS_PATH, DEV_ENTRY_PATH, DEV_MANIFEST_PATH } from '../lib/install/dev'

export const DEV_ENTRY_ID = '\0delta-comic:dev-entry'
export { DEV_CSS_PATH, DEV_ENTRY_PATH, DEV_MANIFEST_PATH }

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
} as const

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

const VUE_STYLE_QUERY = /(?:^|[?&])vue&type=style(?:&|$)/
const CSS_RUNTIME_BYPASS_QUERY = /(?:^|[?&])(?:direct|inline|raw|url)(?:&|$)/

export const createWireManifest = (meta: PluginManifest) => ({ ...meta })

export const createDevEntryCode = (meta: PluginManifest, entryUrl: string) =>
  [
    `import '/@vite/client'`,
    `const __deltaComicCssPath = ${JSON.stringify(DEV_CSS_PATH)}`,
    `const __deltaComicUpdateStyle = async () => {`,
    `  const __deltaComicDocument = globalThis.document`,
    `  if (!__deltaComicDocument) return`,
    `  try {`,
    `    const __deltaComicResponse = await fetch(new URL(__deltaComicCssPath, import.meta.url), { cache: 'no-store' })`,
    `    if (!__deltaComicResponse.ok) return`,
    `    const __deltaComicCss = await __deltaComicResponse.text()`,
    `    for (const __deltaComicStyle of __deltaComicDocument.head.querySelectorAll('style')) {`,
    `      if (__deltaComicStyle.dataset.plugin === ${JSON.stringify(meta.name.id)}) __deltaComicStyle.textContent = __deltaComicCss`,
    `    }`,
    `  } catch {}`,
    `}`,
    `const __deltaComicHot = import.meta.hot`,
    `if (__deltaComicHot) {`,
    `  __deltaComicHot.accept(${JSON.stringify(entryUrl)}, () => {})`,
    `  const __deltaComicAfterUpdate = () => { void __deltaComicUpdateStyle() }`,
    `  __deltaComicHot.on('vite:afterUpdate', __deltaComicAfterUpdate)`,
    `  __deltaComicHot.dispose(() => __deltaComicHot.off('vite:afterUpdate', __deltaComicAfterUpdate))`,
    `}`,
    `export { default } from ${JSON.stringify(entryUrl)}`,
  ].join('\n')

const isCssModuleRequest = (id: string) => isCSSRequest(id) || VUE_STYLE_QUERY.test(id)

const isDevCssRuntimeRequest = (id: string) =>
  !CSS_RUNTIME_BYPASS_QUERY.test(id) && isCssModuleRequest(id)

const stripViteCssRuntime = (code: string) => {
  let stripped = code
  const replacements: [RegExp, string][] = [
    [
      /import\s*\{\s*updateStyle\s+as\s+__vite__updateStyle(?:\s*,\s*removeStyle\s+as\s+__vite__removeStyle)?\s*\}\s*from\s*['"]\/@vite\/client['"]\s*;?/g,
      '',
    ],
    [
      /const\s*\{\s*updateStyle\s*:\s*__vite__updateStyle\s*,\s*removeStyle\s*:\s*__vite__removeStyle\s*\}\s*=\s*import\.meta\.hot\._internal\s*;?/g,
      '',
    ],
    [/const\s+__vite__id\s*=\s*(['"])(?:\\.|(?!\1)[^\\])*\1\s*;?/g, ''],
    [/const\s+__vite__css\s*=\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*;?/g, ''],
    [/__vite__updateStyle\(\s*__vite__id\s*,\s*__vite__css\s*\)\s*;?/g, ''],
    [
      /import\.meta\.hot\.prune\(\s*\(\)\s*=>\s*__vite__removeStyle\(\s*__vite__id\s*\)\s*\)\s*;?/g,
      'import.meta.hot.prune(() => {})',
    ],
  ]
  for (const [pattern, replacement] of replacements)
    stripped = stripped.replace(pattern, replacement)
  return stripped === code ? undefined : stripped
}

const collectCssModules = (
  server: ViteDevServer,
  starts: readonly (ModuleNode | undefined)[],
): ModuleNode[] => {
  const seen = new Set<ModuleNode>()
  const queue: ModuleNode[] = starts.filter((node): node is ModuleNode => node !== undefined)
  const cssModules: ModuleNode[] = []
  while (queue.length > 0) {
    const node = queue.shift()
    if (!node || seen.has(node)) continue
    seen.add(node)
    if (isCssModuleRequest(node.url)) cssModules.push(node)
    for (const imported of node.importedModules) queue.push(imported)
    // Vue SFC style modules share the component file but are not linked through
    // importedModules, so discover them through the file-to-modules map.
    const fileModules = node.file ? (server.moduleGraph.getModulesByFile?.(node.file) ?? []) : []
    for (const fileModule of fileModules) queue.push(fileModule)
  }
  return cssModules
}

const toOriginAbsoluteUrls = (css: string, origin: string) =>
  css.replace(/(url\(\s*(?:"|')?)\/(?!\/)/g, `$1${origin}/`)

const collectDevCss = async (
  server: ViteDevServer,
  origin: string,
  entryUrl: string,
): Promise<string> => {
  const entryModule = await server.moduleGraph.getModuleByUrl?.(entryUrl)
  const modules = collectCssModules(server, [
    server.moduleGraph.getModuleById(DEV_ENTRY_ID),
    entryModule,
  ])
  const parts: string[] = []
  for (const module of modules) {
    const directUrl = `${module.url}${module.url.includes('?') ? '&' : '?'}direct`
    const result = await server.transformRequest(directUrl)
    if (result?.code) parts.push(toOriginAbsoluteUrls(result.code, origin))
  }
  return parts.join('\n')
}

const sendJson = (res: ServerResponse, body: unknown) => {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    ...NO_CACHE_HEADERS,
    ...CORS_HEADERS,
  })
  res.end(JSON.stringify(body))
}

const sendError = (res: ServerResponse, status: number, message: string) => {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...NO_CACHE_HEADERS,
    ...CORS_HEADERS,
  })
  res.end(message)
}

const requestOrigin = (req: IncomingMessage) => {
  const secure = 'encrypted' in req.socket && req.socket.encrypted === true
  return `${secure ? 'https' : 'http'}://${req.headers.host}`
}

export const createDevPlugin = (meta: PluginManifest): Plugin => {
  let server: ViteDevServer | undefined
  let entryUrl = '/src/main.ts'

  return {
    name: 'delta-comic:dev-server',
    enforce: 'post',
    config() {
      return { server: { cors: true } }
    },
    configureServer(devServer) {
      server = devServer
      const entryFile = resolve(devServer.config.root, 'src/main.ts')
      entryUrl = `/${normalizePath(relative(devServer.config.root, entryFile))}`

      const handleManifest: Connect.NextHandleFunction = (req, res, next) => {
        if (new URL(req.url ?? '/', 'http://localhost').pathname !== DEV_MANIFEST_PATH) {
          return next()
        }
        sendJson(res, createWireManifest(meta))
      }
      const handleEntry: Connect.NextHandleFunction = async (req, res, next) => {
        if (new URL(req.url ?? '/', 'http://localhost').pathname !== DEV_ENTRY_PATH) {
          return next()
        }
        if (!server) return next()
        try {
          const result = await server.transformRequest(DEV_ENTRY_ID)
          if (!result?.code) {
            sendError(res, 500, `[delta-comic] failed to transform the plugin entry ${entryUrl}`)
            return
          }
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            ...NO_CACHE_HEADERS,
            ...CORS_HEADERS,
          })
          res.end(result.code)
        } catch (error) {
          sendError(res, 500, error instanceof Error ? error.message : String(error))
        }
      }
      const handleCss: Connect.NextHandleFunction = async (req, res, next) => {
        if (new URL(req.url ?? '/', 'http://localhost').pathname !== DEV_CSS_PATH) {
          return next()
        }
        if (!server) return next()
        try {
          const css = await collectDevCss(server, requestOrigin(req), entryUrl)
          res.writeHead(200, {
            'Content-Type': 'text/css; charset=utf-8',
            ...NO_CACHE_HEADERS,
            ...CORS_HEADERS,
          })
          res.end(css)
        } catch (error) {
          sendError(res, 500, error instanceof Error ? error.message : String(error))
        }
      }
      devServer.middlewares.use(handleManifest)
      devServer.middlewares.use(handleEntry)
      devServer.middlewares.use(handleCss)
    },
    resolveId(id) {
      if (id === DEV_ENTRY_ID) return DEV_ENTRY_ID
    },
    load(id) {
      if (id !== DEV_ENTRY_ID || !server) return
      return createDevEntryCode(meta, entryUrl)
    },
    transform(code, id) {
      if (!isDevCssRuntimeRequest(id)) return
      return stripViteCssRuntime(code)
    },
  }
}