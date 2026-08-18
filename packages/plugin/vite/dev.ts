import type { IncomingMessage, ServerResponse } from 'node:http'
import { relative, resolve } from 'node:path'

import type { PluginManifest } from '@delta-comic/model'
import type { Connect, ModuleNode, Plugin, ViteDevServer } from 'vite'
import { isCSSRequest, normalizePath } from 'vite'

import {
  DEV_CSS_PATH,
  DEV_ENTRY_PATH,
  DEV_HMR_PATH,
  DEV_MANIFEST_PATH,
  DEV_PLUGIN_HMR_EVENT,
} from '../lib/install/dev'

export const DEV_ENTRY_ID = '\0delta-comic:dev-entry'
export { DEV_CSS_PATH, DEV_ENTRY_PATH, DEV_HMR_PATH, DEV_MANIFEST_PATH, DEV_PLUGIN_HMR_EVENT }

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
} as const

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

export const createWireManifest = (meta: PluginManifest) => ({
  ...meta,
  entry: { jsPath: 'index.js', cssPath: 'index.css' },
})

export const createDevEntryCode = (meta: PluginManifest, entryUrl: string) =>
  [
    `export { default } from ${JSON.stringify(entryUrl)}`,
    '',
    `const __deltaComicPluginId = ${JSON.stringify(meta.name.id)}`,
    'const __deltaComicHmrSources = (window.__deltaComicHmrSources ??= new Map())',
    'if (!__deltaComicHmrSources.has(__deltaComicPluginId)) {',
    `  const source = new EventSource(new URL(import.meta.url).origin + ${JSON.stringify(DEV_HMR_PATH)})`,
    `  source.addEventListener('reload', () => {`,
    `    window.dispatchEvent(new CustomEvent(${JSON.stringify(DEV_PLUGIN_HMR_EVENT)}, { detail: { pluginId: __deltaComicPluginId } }))`,
    `  })`,
    '  __deltaComicHmrSources.set(__deltaComicPluginId, source)',
    '}',
  ].join('\n')

const collectCssModules = (start: ModuleNode | undefined): ModuleNode[] => {
  if (!start) return []
  const seen = new Set<ModuleNode>()
  const queue: ModuleNode[] = [start]
  const cssModules: ModuleNode[] = []
  while (queue.length > 0) {
    const node = queue.shift()
    if (!node || seen.has(node)) continue
    seen.add(node)
    if (isCSSRequest(node.url)) cssModules.push(node)
    for (const imported of node.importedModules) queue.push(imported)
  }
  return cssModules
}

const toOriginAbsoluteUrls = (css: string, origin: string) =>
  css.replace(/(url\(\s*(?:"|')?)\/(?!\/)/g, `$1${origin}/`)

const collectDevCss = async (server: ViteDevServer, origin: string): Promise<string> => {
  const modules = collectCssModules(server.moduleGraph.getModuleById(DEV_ENTRY_ID))
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

const createHmrMiddleware = (server: ViteDevServer): Connect.NextHandleFunction => {
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const broadcast = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      for (const send of listeners) send()
    }, 100)
  }
  server.watcher.on('change', broadcast)
  server.watcher.on('add', broadcast)
  server.watcher.on('unlink', broadcast)

  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== DEV_HMR_PATH) return next()
    if (req.headers.accept !== 'text/event-stream') {
      sendError(res, 406, 'SSE connection required')
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      ...NO_CACHE_HEADERS,
      ...CORS_HEADERS,
      'Connection': 'keep-alive',
    })
    res.write('retry: 1000\n\n')
    const send = () => res.write('event: reload\ndata: {}\n\n')
    listeners.add(send)
    req.on('close', () => listeners.delete(send))
  }
}

export const createDevPlugin = (meta: PluginManifest): Plugin => {
  let server: ViteDevServer | undefined
  let entryUrl = '/src/main.ts'

  return {
    name: 'delta-comic:dev-server',
    configureServer(devServer) {
      server = devServer
      const entrySource = meta.entry?.jsPath ?? 'src/main.ts'
      const entryFile = resolve(devServer.config.root, entrySource)
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
          const css = await collectDevCss(server, requestOrigin(req))
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
      const handleHmr = createHmrMiddleware(devServer)

      devServer.middlewares.use(handleManifest)
      devServer.middlewares.use(handleEntry)
      devServer.middlewares.use(handleCss)
      devServer.middlewares.use(handleHmr)
    },
    resolveId(id) {
      if (id === DEV_ENTRY_ID) return DEV_ENTRY_ID
    },
    load(id) {
      if (id !== DEV_ENTRY_ID || !server) return
      return createDevEntryCode(meta, entryUrl)
    },
  }
}