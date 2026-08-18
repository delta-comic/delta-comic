import type { IncomingMessage, ServerResponse } from 'node:http'

import type { PluginManifest } from '@delta-comic/model'
import type { ModuleNode, ViteDevServer } from 'vite'
import { describe, expect, it, vi, type Mock } from 'vite-plus/test'

import {
  DEV_CSS_PATH,
  DEV_ENTRY_ID,
  DEV_ENTRY_PATH,
  DEV_MANIFEST_PATH,
  createDevEntryCode,
  createDevPlugin,
  createWireManifest,
} from '../../vite/dev'

const meta: PluginManifest = {
  apiVersion: 1,
  name: { display: 'Dev Plugin', id: 'dev-plugin' },
  version: { plugin: '1.0.0', supportCore: '1.0.0' },
  author: 'delta',
  description: 'dev plugin',
  icon: 'assets/icon.svg',
  require: [],
  entry: { jsPath: 'src/main.ts' },
}

type TestMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void

type FakeServer = {
  config: { root: string }
  middlewares: { use: ReturnType<typeof vi.fn> }
  moduleGraph: { getModuleById: ReturnType<typeof vi.fn> }
  transformRequest: ReturnType<typeof vi.fn>
}

const createFakeServer = (): FakeServer => ({
  config: { root: '/project' },
  middlewares: { use: vi.fn() },
  moduleGraph: { getModuleById: vi.fn() },
  transformRequest: vi.fn(),
})

const registeredMiddleware = (server: FakeServer): TestMiddleware[] =>
  server.middlewares.use.mock.calls.map(call => call[0] as TestMiddleware)

type TestDevPlugin = {
  configureServer(server: ViteDevServer): void
  transform(code: string, id: string): string | undefined
}

type FakeResponse = ServerResponse & { end: Mock; writeHead: Mock; write: Mock }

const createFakeResponse = (): FakeResponse =>
  ({
    writeHead: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
    statusCode: 0,
  }) as unknown as FakeResponse

const request = (path: string, headers: Record<string, string> = {}) =>
  ({ url: path, headers, socket: { encrypted: false } }) as unknown as IncomingMessage

const cssModule = (url: string): ModuleNode =>
  ({ url, type: 'css', importedModules: new Set() }) as unknown as ModuleNode

describe('createWireManifest', () => {
  it('exposes the fixed development entry paths', () => {
    const wire = createWireManifest(meta)

    expect(wire.name.id).toBe('dev-plugin')
    expect(wire.entry).toEqual({ jsPath: 'index.js', cssPath: 'index.css' })
  })
})

describe('createDevEntryCode', () => {
  it('re-exports the default factory of the resolved entry', () => {
    const code = createDevEntryCode(meta, '/src/main.ts')

    expect(code).toContain(`export { default } from "/src/main.ts"`)
  })

  it('loads the Vite HMR client from the plugin dev server', () => {
    const code = createDevEntryCode(meta, '/src/main.ts')

    expect(code).toContain(`import '/@vite/client'`)
    expect(code).not.toContain('EventSource')
    expect(code).not.toContain('delta-comic:plugin-hmr')
  })

  it('refreshes the independent stylesheet through native HMR', () => {
    const code = createDevEntryCode(meta, '/src/main.ts')

    expect(code).toContain('const __deltaComicCssPath = "/index.css"')
    expect(code).toContain('new URL(__deltaComicCssPath, import.meta.url)')
    expect(code).toContain('__deltaComicHot.accept("/src/main.ts", () => {})')
    expect(code).toContain("__deltaComicHot.on('vite:afterUpdate'")
    expect(code).toContain("__deltaComicHot.off('vite:afterUpdate'")
  })
})

describe('CSS runtime transform', () => {
  const viteCss = [
    `const { updateStyle: __vite__updateStyle, removeStyle: __vite__removeStyle } = import.meta.hot._internal`,
    `const __vite__id = "/src/style.css"`,
    `const __vite__css = "body{}"`,
    `__vite__updateStyle(__vite__id, __vite__css)`,
    `import.meta.hot.accept()`,
    `import.meta.hot.prune(() => __vite__removeStyle(__vite__id))`,
  ].join('\n')

  it('removes Vite style ownership while retaining HMR acceptance', () => {
    const plugin = createDevPlugin(meta) as unknown as TestDevPlugin

    const transformed = plugin.transform(viteCss, '/src/style.css')

    expect(transformed).toContain('import.meta.hot.accept()')
    expect(transformed).toContain('import.meta.hot.prune(() => {})')
    expect(transformed).not.toContain('__vite__updateStyle')
    expect(transformed).not.toContain('__vite__css')
  })

  it('strips compact CSS runtime output and preserves module exports', () => {
    const plugin = createDevPlugin(meta) as unknown as TestDevPlugin
    const transformed = plugin.transform(
      'import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from "/@vite/client";const __vite__id = "/src/style.module.css";const __vite__css = ".foo{}";__vite__updateStyle(__vite__id, __vite__css);import.meta.hot.accept();import.meta.hot.prune(() => __vite__removeStyle(__vite__id));export default { foo: "_foo" }',
      '/src/style.module.css',
    )

    expect(transformed).toContain('import.meta.hot.accept()')
    expect(transformed).toContain('export default { foo: "_foo" }')
    expect(transformed).not.toContain('__vite__updateStyle')
    expect(transformed).not.toContain('__vite__css')
  })

  it('recognizes Vue SFC styles without intercepting direct CSS reads', () => {
    const plugin = createDevPlugin(meta) as unknown as TestDevPlugin

    expect(plugin.transform(viteCss, '/src/App.vue?vue&type=style&index=0&scoped=true')).toContain(
      'import.meta.hot.accept()',
    )
    expect(plugin.transform(viteCss, '/src/style.css?direct')).toBeUndefined()
    expect(plugin.transform(viteCss, '/src/style.css?inline')).toBeUndefined()
  })
})

describe('createDevPlugin middleware', () => {
  const setup = () => {
    const server = createFakeServer()
    const plugin = createDevPlugin(meta) as unknown as TestDevPlugin
    plugin.configureServer(server as unknown as ViteDevServer)
    const [manifest, entry, css] = registeredMiddleware(server)
    return { server, manifest, entry, css }
  }

  it('serves the wire manifest with JSON and no-cache CORS headers', () => {
    const { manifest } = setup()
    const res = createFakeResponse()

    manifest(request(DEV_MANIFEST_PATH), res, () => undefined)

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Cache-Control': expect.stringContaining('no-cache'),
        'Access-Control-Allow-Origin': '*',
      }),
    )
    const body = JSON.parse(res.end.mock.calls[0][0] as string)
    expect(body.entry).toEqual({ jsPath: 'index.js', cssPath: 'index.css' })
  })

  it('passes through requests for other paths', () => {
    const { manifest, entry, css } = setup()
    const next = vi.fn()

    manifest(request('/other.js'), {} as ServerResponse, next)
    entry(request('/other.js'), {} as ServerResponse, next)
    css(request('/other.js'), {} as ServerResponse, next)

    expect(next).toHaveBeenCalledTimes(3)
  })

  it('serves the transformed dev entry as a no-cache module', async () => {
    const { server, entry } = setup()
    const res = createFakeResponse()
    server.transformRequest.mockResolvedValue({ code: 'export default 1' })

    await entry(request(DEV_ENTRY_PATH), res, () => undefined)

    expect(server.transformRequest).toHaveBeenCalledWith(DEV_ENTRY_ID)
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'application/javascript; charset=utf-8' }),
    )
    expect(res.end).toHaveBeenCalledWith('export default 1')
  })

  it('reports transform failures with a 500 response', async () => {
    const { server, entry } = setup()
    const res = createFakeResponse()
    server.transformRequest.mockRejectedValue(new Error('boom'))

    await entry(request(DEV_ENTRY_PATH), res, () => undefined)

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything())
    expect(res.end).toHaveBeenCalledWith('boom')
  })

  it('collects CSS from the entry module graph and makes asset URLs origin-absolute', async () => {
    const { server, css } = setup()
    const style = cssModule('/src/style.css')
    const sfcStyle = cssModule('/src/App.vue?vue&type=style&index=0&lang.css')
    const js = { url: '/src/main.ts', type: 'js', importedModules: new Set([style, sfcStyle]) }
    server.moduleGraph.getModuleById.mockReturnValue(js)
    server.transformRequest
      .mockResolvedValueOnce({ code: 'body{background:url("/assets/bg.png")}' })
      .mockResolvedValueOnce({ code: '.app{}' })
    const res = createFakeResponse()

    await css(request(DEV_CSS_PATH, { host: 'localhost:5173' }), res, () => undefined)

    expect(server.transformRequest).toHaveBeenCalledWith('/src/style.css?direct')
    expect(server.transformRequest).toHaveBeenCalledWith(
      '/src/App.vue?vue&type=style&index=0&lang.css&direct',
    )
    expect(res.end).toHaveBeenCalledWith(
      'body{background:url("http://localhost:5173/assets/bg.png")}\n.app{}',
    )
  })

  it('serves an empty stylesheet when the plugin has no CSS', async () => {
    const { server, css } = setup()
    server.moduleGraph.getModuleById.mockReturnValue({
      url: '/src/main.ts',
      type: 'js',
      importedModules: new Set(),
    })
    const res = createFakeResponse()

    await css(request(DEV_CSS_PATH, { host: 'localhost:5173' }), res, () => undefined)

    expect(res.end).toHaveBeenCalledWith('')
  })
})