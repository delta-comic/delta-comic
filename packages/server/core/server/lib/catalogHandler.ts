import {
  parsePluginCatalogIndex,
  PluginCatalogConflictError,
  type PluginCatalogStore,
} from './catalogProtocol/index.js'

export interface PluginCatalogHandlerOptions {
  store: PluginCatalogStore
  pathname?: string
  authorizeWrite?: (request: Request) => boolean | Promise<boolean>
}

export interface PluginCatalogHandler {
  fetch(request: Request): Promise<Response>
}

const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

export const createPluginCatalogHandler = (
  options: PluginCatalogHandlerOptions,
): PluginCatalogHandler => {
  const pathname = options.pathname ?? '/plugins/catalog/index.json'
  const authorizeWrite = options.authorizeWrite ?? (() => false)

  return {
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname !== pathname) return new Response('Not Found', { status: 404 })

      if (request.method === 'GET') {
        if (options.store.loadSnapshot) {
          const snapshot = await options.store.loadSnapshot()
          return snapshot.index
            ? json(snapshot.index, 200, { 'etag': snapshot.version, 'cache-control': 'no-store' })
            : new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
        }
        const index = await options.store.load()
        return index ? json(index) : new Response(null, { status: 404 })
      }

      if (request.method !== 'PUT') {
        return new Response(null, { status: 405, headers: { allow: 'GET, PUT' } })
      }

      if (!(await authorizeWrite(request))) return new Response(null, { status: 401 })

      try {
        const ifMatch = request.headers.get('if-match')
        const ifNoneMatch = request.headers.get('if-none-match')
        if (
          (ifMatch !== null && ifNoneMatch !== null) ||
          (ifMatch !== null && !/^"[\x21\x23-\x7e\x80-\xff]*"$/.test(ifMatch)) ||
          (ifNoneMatch !== null && ifNoneMatch !== '*')
        ) {
          throw new TypeError('expected a single strong If-Match ETag or If-None-Match: *')
        }
        const expectedVersion = ifMatch ?? (ifNoneMatch === '*' ? null : undefined)
        if (expectedVersion !== undefined && !options.store.loadSnapshot) {
          return json({ error: 'catalog store does not support conditional writes' }, 501)
        }
        const parsed = parsePluginCatalogIndex(await request.json())
        await options.store.save(parsed, expectedVersion)
        return json(parsed)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid catalog payload'
        return json({ error: message }, error instanceof PluginCatalogConflictError ? 412 : 400)
      }
    },
  }
}