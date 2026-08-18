import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { PluginManifest } from '@delta-comic/model'
import type { InlineConfig } from 'vite'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import {
  DEV_CSS_PATH,
  DEV_ENTRY_PATH,
  DEV_HMR_PATH,
  DEV_MANIFEST_PATH,
  createDevPlugin,
} from '../../vite/dev'

const meta: PluginManifest = {
  apiVersion: 1,
  name: { display: 'Dev Plugin', id: 'dev-plugin' },
  version: { plugin: '1.0.0', supportCore: '1.0.0' },
  author: 'delta',
  description: 'dev plugin',
  require: [],
  entry: { jsPath: 'src/main.ts' },
}

let root: string
let server: Awaited<ReturnType<typeof createServer>>
let base: string

const get = async (path: string) => {
  const response = await fetch(`${base}${path}`)
  return { status: response.status, text: await response.text(), headers: response.headers }
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dc-plugin-dev-'))
  await mkdir(join(root, 'src'))
  await writeFile(
    join(root, 'src/main.ts'),
    `import './style.css'\nexport default () => ({ name: 'dev-plugin' })\n`,
  )
  await writeFile(join(root, 'src/style.css'), 'body { color: red }\n')
  server = await createServer({
    root,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
    plugins: [createDevPlugin(meta)],
  } satisfies InlineConfig)
  base = await new Promise<string>((resolve, reject) => {
    const listener = createHttpServer(server.middlewares)
    listener.on('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address() as { port: number }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
})

afterAll(async () => {
  await server.close()
  await rm(root, { recursive: true, force: true })
})

const retry = async (check: () => Promise<boolean>, timeoutMs = 3_000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await check()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('condition not met in time')
}

describe('deltaComic dev protocol', () => {
  it('serves the wire manifest with fixed entry paths and CORS', async () => {
    const { status, text, headers } = await get(DEV_MANIFEST_PATH)

    expect(status).toBe(200)
    expect(headers.get('access-control-allow-origin')).toBe('*')
    expect(headers.get('cache-control')).toContain('no-cache')
    expect(JSON.parse(text).entry).toEqual({ jsPath: 'index.js', cssPath: 'index.css' })
  })

  it('serves the transformed dev entry module', async () => {
    const { status, text, headers } = await get(DEV_ENTRY_PATH)

    expect(status).toBe(200)
    expect(headers.get('content-type')).toContain('javascript')
    expect(text).toContain('export { default } from "/src/main.ts"')
    expect(text).toContain(
      'new EventSource(new URL(import.meta.url).origin + "/__delta-comic__/hmr")',
    )
    expect(text).toContain('"dev-plugin"')
  })

  it('serves the plugin entry source through the normal transform pipeline', async () => {
    const { status, text } = await get('/src/main.ts')

    expect(status).toBe(200)
    expect(text).toContain('export default () => ({ name: "dev-plugin" })')
  })

  it('collects CSS from the entry module graph', async () => {
    const { status, text, headers } = await get(DEV_CSS_PATH)

    expect(status).toBe(200)
    expect(headers.get('content-type')).toContain('text/css')
    expect(text).toContain('color: red')
  })

  it('reflects file changes without restart', async () => {
    await writeFile(join(root, 'src/style.css'), 'body { color: blue }\n')

    await retry(async () => (await get(DEV_CSS_PATH)).text.includes('color: blue'))
  })

  it('streams SSE reload events from the HMR endpoint', async () => {
    const controller = new AbortController()
    const stream = await fetch(`${base}${DEV_HMR_PATH}`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    })

    expect(stream.status).toBe(200)
    expect(stream.headers.get('content-type')).toContain('text/event-stream')

    await writeFile(join(root, 'src/main.ts'), 'export default () => ({ name: "dev-plugin" })\n')

    const chunks: string[] = []
    const reader = stream.body!.getReader()
    const decoder = new TextDecoder()
    await retry(async () => {
      const { value } = await reader.read()
      if (value) chunks.push(decoder.decode(value))
      return chunks.join('').includes('event: reload')
    })
    controller.abort()
  })
})