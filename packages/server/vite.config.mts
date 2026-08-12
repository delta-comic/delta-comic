import { fileURLToPath, URL } from 'node:url'

import { defineConfig, lazyPlugins } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: [
    { entry: './app/index.ts', dts: { tsconfig: './tsconfig.app.json' } },
    { entry: './lib/index.ts', dts: { tsconfig: './tsconfig.lib.json' } },
  ],
  plugins: lazyPlugins((async () => {
    if (process.env.VITEST || process.env.VP_COMMAND == 'test') return []
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    return [cloudflare()]
  }) as any),
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