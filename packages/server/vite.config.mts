import { fileURLToPath } from 'node:url'

import { defineConfig, lazyPlugins } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: { entry: './app/index.ts', dts: { tsgo: true, tsconfig: './tsconfig.app.json' } },
  plugins: lazyPlugins(async () => {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    return [cloudflare()]
  }),
  root,
  test: { environment: 'node', include: ['app/**/*.test.ts'] },
})