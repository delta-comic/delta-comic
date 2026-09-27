import { fileURLToPath, URL } from 'node:url'

import type { UserConfig } from 'vite-plus'
import { defineConfig, lazyPlugins } from 'vite-plus'

export default defineConfig({
  plugins: lazyPlugins((async () => {
    const [
      { default: tailwindcss },
      { default: vue },
      { default: vueJsx },
      { NaiveUiResolver },
      { default: Components },
      { default: vueDevTools },
    ] = await Promise.all([
      import('@tailwindcss/vite'),
      import('@vitejs/plugin-vue'),
      import('@vitejs/plugin-vue-jsx'),
      import('unplugin-vue-components/resolvers'),
      import('unplugin-vue-components/vite'),
      import('vite-plugin-vue-devtools'),
    ])
    return [
      vueDevTools(),
      vue(),
      vueJsx(),
      Components({ dts: true, dtsTsx: false, resolvers: [NaiveUiResolver()] }),
      tailwindcss(),
    ]
  }) as any),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts', '.vue'],
  },
  css: { transformer: 'lightningcss' },
  build: { outDir: 'dist', target: 'es2022', minify: 'oxc' },
  run: {
    tasks: {
      'build': {
        command: 'vp build',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: ['dist/**'],
      },
      'deploy': {
        command: 'wrangler pages deploy dist --project-name=delta-comic-server-admin',
        cache: false,
        dependsOn: ['build'],
      },
      'dev': { command: 'vp dev', cache: false },
      'pages:preview': {
        command: 'wrangler pages dev dist --compatibility-date=2026-06-28',
        cache: false,
        dependsOn: ['build'],
      },
      'preview': { command: 'vp preview', cache: false, dependsOn: ['build'] },
      'typecheck': {
        command: ['vue-tsc -p tsconfig.app.json --noEmit', 'tsc -p tsconfig.node.json --noEmit'],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: [],
      },
    },
  },
  server: { port: 5174, strictPort: true },
  test: { environment: 'happy-dom', include: ['test/**/*.test.ts'] },
} as UserConfig)