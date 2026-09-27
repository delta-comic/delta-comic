import { parsePluginCatalogIndex, type PluginCatalogStore } from '@delta-comic/both'

export interface PluginCatalogHandlerOptions {
  store: PluginCatalogStore
  pathname?: string
  authorizeWrite?: (request: Request) => boolean | Promise<boolean>
}

export interface PluginCatalogHandler {
  fetch(request: Request): Promise<Response>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
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
        const index = await options.store.load()
        return index ? json(index) : new Response(null, { status: 404 })
      }

      if (request.method !== 'PUT') {
        return new Response(null, { status: 405, headers: { allow: 'GET, PUT' } })
      }

      if (!(await authorizeWrite(request))) return new Response(null, { status: 401 })

      try {
        const parsed = parsePluginCatalogIndex(await request.json())
        await options.store.save(parsed)
        return json(parsed)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid catalog payload'
        return json({ error: message }, 400)
      }
    },
  }
}