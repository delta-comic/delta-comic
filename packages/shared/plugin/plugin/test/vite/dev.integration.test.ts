import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { PluginManifest } from '@delta-comic/model'
import vue from '@vitejs/plugin-vue'
import type { InlineConfig } from 'vite'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import { DEV_CSS_PATH, DEV_ENTRY_PATH, DEV_MANIFEST_PATH, createDevPlugin } from '../../vite/dev'

const meta: PluginManifest = {
  apiVersion: 1,
  name: { display: 'Dev Plugin', id: 'dev-plugin' },
  version: { plugin: '1.0.0', supportCore: '1.0.0' },
  author: 'delta',
  description: 'dev plugin',
  require: [],
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
    `import './index.css'\nimport styles from './style.module.css'\nimport App from './App.vue'\nexport const devComponents = { App, styles }\nexport default () => ({ name: 'dev-plugin' })\n`,
  )
  await writeFile(join(root, 'src/index.css'), 'body { color: red }\n')
  await writeFile(join(root, 'src/style.module.css'), '.module { color: green }\n')
  await writeFile(
    join(root, 'src/App.vue'),
    `<template><div class="app">Hello</div></template>\n<style scoped>.app { color: purple }</style>\n`,
  )
  server = await createServer({
    root,
    logLevel: 'silent',
    server: { middlewareMode: true },
    plugins: [vue(), createDevPlugin(meta)],
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
    expect(JSON.parse(text).entry).toBeUndefined()
  })

  it('serves the transformed dev entry module', async () => {
    const { status, text, headers } = await get(DEV_ENTRY_PATH)

    expect(status).toBe(200)
    expect(headers.get('content-type')).toContain('javascript')
    expect(text).toContain("import '/@vite/client'")
    expect(text).toContain('export { default } from "/src/main.ts"')
    expect(text).toContain('const __deltaComicCssPath = "/index.css"')
    expect(text).toContain('new URL(__deltaComicCssPath, import.meta.url)')
    expect(text).not.toContain('EventSource')
    expect(text).toContain('"dev-plugin"')
  })

  it('serves the plugin entry source through the normal transform pipeline', async () => {
    const { status, text } = await get('/src/main.ts')

    expect(status).toBe(200)
    expect(text).toContain('export default () => ({ name: "dev-plugin" })')
  })

  it('collects CSS from the entry module graph', async () => {
    // The host imports the entry before requesting the independent stylesheet. Warm the same
    // dependency graph here so nested Vue style modules are available to the CSS endpoint.
    await get('/src/main.ts')
    await get('/src/style.module.css')
    await get('/src/App.vue')
    await get('/src/App.vue?vue&type=style&index=0&scoped=true&lang.css')

    const { status, text, headers } = await get(DEV_CSS_PATH)

    expect(status).toBe(200)
    expect(headers.get('content-type')).toContain('text/css')
    expect(text).toContain('color: red')
    expect(text).toContain('color: green')
    expect(text).toContain('color: purple')
  })

  it('reflects file changes without restart', async () => {
    await writeFile(join(root, 'src/index.css'), 'body { color: blue }\n')

    await retry(async () => (await get(DEV_CSS_PATH)).text.includes('color: blue'))
  })

  it('keeps Vite CSS modules in the graph without injecting a second style node', async () => {
    const { status, text } = await get('/src/index.css')

    expect(status).toBe(200)
    expect(text).toContain('import.meta.hot.accept()')
    expect(text).toContain('import.meta.hot.prune(() => {})')
    expect(text).not.toContain('__vite__updateStyle')
    expect(text).not.toContain('__vite__css')
  })

  it('keeps CSS module exports while removing its Vite style runtime', async () => {
    const { status, text } = await get('/src/style.module.css')

    expect(status).toBe(200)
    expect(text).toContain('import.meta.hot')
    expect(text).toContain('import.meta.hot.prune(() => {})')
    expect(text).toContain('export default')
    expect(text).not.toContain('__vite__updateStyle')
    expect(text).not.toContain('__vite__css')
  })

  it('removes the Vite style runtime from Vue SFC styles', async () => {
    const { status, text } = await get('/src/App.vue?vue&type=style&index=0&scoped=true&lang.css')

    expect(status).toBe(200)
    expect(text).toContain('import.meta.hot')
    expect(text).toContain('import.meta.hot.prune(() => {})')
    expect(text).not.toContain('__vite__updateStyle')
    expect(text).not.toContain('__vite__css')
  })
})