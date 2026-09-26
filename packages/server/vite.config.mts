import { fileURLToPath, URL } from 'node:url'

import { transform } from '@swc/core'
import { defineConfig, lazyPlugins } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))
const lowerDecorators = async (code: string, id: string) => {
  if (!/\.[cm]?tsx?$/.test(id) || id.includes('node_modules')) return
  const result = await transform(code, {
    filename: id,
    sourceMaps: true,
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', decorators: true },
      transform: { decoratorVersion: '2023-11', legacyDecorator: false, decoratorMetadata: false },
    },
  })
  return { code: result.code, map: result.map }
}
const decoratorPlugin = { name: 'delta-comic:lower-decorators', transform: lowerDecorators }

export default defineConfig({
  pack: [
    {
      entry: './app/index.ts',
      dts: { tsconfig: './tsconfig.app.json' },
      plugins: [decoratorPlugin as any],
    },
    {
      entry: './lib/index.ts',
      dts: { tsconfig: './tsconfig.lib.json' },
      plugins: [decoratorPlugin as any],
    },
  ],
  plugins: [
    decoratorPlugin as any,
    lazyPlugins((async () => {
      if (process.env.VITEST || process.env.VP_COMMAND == 'test') return []
      const { cloudflare } = await import('@cloudflare/vite-plugin')
      return [cloudflare()]
    }) as any),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./app', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts'],
  },
  root,
  run: {
    tasks: {
      'build': {
        command: 'vp build',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: ['dist/**'],
      },
      'cf-typegen': { command: 'wrangler types', output: ['worker-configuration.d.ts'] },
      'deploy': { command: 'wrangler deploy', cache: false, dependsOn: ['build'] },
      'dev': { command: 'wrangler dev --config wrangler.jsonc', cache: false },
      'migrate:local': {
        command: 'wrangler d1 migrations apply delta-comic-server-db --local',
        cache: false,
      },
      'migrate:remote': {
        command: 'wrangler d1 migrations apply delta-comic-server-db --remote',
        cache: false,
      },
      'preview': { command: 'vp preview', cache: false, dependsOn: ['build'] },
      'typecheck': {
        command: ['tsc -p tsconfig.app.json --noEmit', 'tsc -p tsconfig.node.json --noEmit'],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: [],
      },
    },
  },
  test: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflareWorkers.ts', import.meta.url)),
    },
    environment: 'node',
    include: ['test/**/*.test.ts'],
    root,
  },
})