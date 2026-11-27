import { createHash, randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'

import { build, type Plugin } from 'vite-plus'

import type { ModulePluginOptions } from './vite-modules'

export function createDevPlugin(options: ModulePluginOptions): Plugin {
  return {
    name: 'delta-comic:development-revisions',
    apply: 'serve',
    configureServer(server) {
      const session = randomUUID()
      const clients = new Set<ServerResponse>()
      const revisions = new Map<string, Map<string, string | Uint8Array>>()
      let sequence = 0
      let revision = ''
      const event = () =>
        `data: ${JSON.stringify({ session, sequence, id: options.id, revision })}\n\n`
      async function rebuild() {
        const result = await build({
          root: server.config.root,
          configFile: server.config.configFile || undefined,
          mode: server.config.mode,
          build: { write: false, watch: null },
        })
        if ('on' in result) throw new Error('unexpected build watcher')
        const files = new Map<string, string | Uint8Array>()
        for (const output of Array.isArray(result) ? result : [result]) {
          for (const file of output.output)
            files.set(file.fileName, file.type === 'chunk' ? file.code : file.source)
        }
        const manifest = files.get('manifest.json')
        if (!manifest) throw new Error('missing development manifest')
        const next = createHash('sha256').update(manifest).digest('hex')
        if (next === revision) return
        revision = next
        revisions.set(next, files)
        sequence++
        for (const client of clients) client.write(event())
      }
      let pending = false
      let building = false
      const schedule = async () => {
        pending = true
        if (building) return
        building = true
        try {
          while (pending) {
            pending = false
            try {
              await rebuild()
            } catch (error) {
              server.config.logger.error(String(error))
            }
          }
        } finally {
          building = false
        }
      }
      void schedule()
      server.watcher.on('all', schedule)
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname
        if (!['/manifest.json', '/events'].includes(path) && !path.startsWith('/revisions/'))
          return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Cache-Control', 'no-store')
        if (path === '/events') {
          res.setHeader('Content-Type', 'text/event-stream')
          res.flushHeaders()
          clients.add(res)
          if (revision) res.write(event())
          res.on('close', () => clients.delete(res))
          return
        }
        const [, , hash, ...segments] = path.split('/')
        const file =
          path === '/manifest.json'
            ? revisions.get(revision)?.get('manifest.json')
            : revisions.get(hash)?.get(segments.join('/'))
        res.statusCode = file === undefined ? 404 : 200
        res.end(file)
      })
      server.httpServer?.once('close', () => {
        server.watcher.off('all', schedule)
        for (const client of clients) client.end()
      })
    },
  }
}