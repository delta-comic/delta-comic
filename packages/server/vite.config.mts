import { fileURLToPath, URL } from 'node:url'

import { defineConfig, lazyPlugins } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: [
    { entry: './app/index.ts', dts: { tsgo: true, tsconfig: './tsconfig.app.json' } },
    { entry: './lib/index.ts', dts: { tsgo: true, tsconfig: './tsconfig.lib.json' } },
  ],
  plugins: lazyPlugins((async () => {
    if (process.env.VP_COMMAND == 'test') return []
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    return [cloudflare()]
  }) as any),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./app', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts'],
  },
  root,
  test: { environment: 'node', include: ['app/**/*.test.ts', 'lib/**/*.test.ts'], root },
})