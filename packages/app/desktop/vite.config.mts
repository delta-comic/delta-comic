import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { transform } from '@swc/core'
import { defineConfig } from '@vizejs/vite-plugin/vite-plus'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import { defaultClientConditions, lazyPlugins } from 'vite-plus'

const host = process.env.TAURI_DEV_HOST
const runtimeFile = fileURLToPath(import.meta.resolve('@delta-comic/runtime/host-libraries.umd.js'))
const appRuntimeFile = resolve(import.meta.dirname, 'public/runtime/host-libraries.umd.js')
// Release CI builds the workspace libraries and the shared runtime once in the `plan` job and
// downloads the artifacts into place; skip rebuilding them on each platform runner.
const skipLibBuild = process.env.DELTA_SKIP_LIB_BUILD === 'true'
const decoratorPlugin = {
  name: 'delta-comic:lower-decorators',
  async transform(code: string, id: string) {
    if (!/\.[cm]?ts$/.test(id) || id.includes('node_modules')) return
    const result = await transform(code, {
      filename: id,
      sourceMaps: true,
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          decoratorVersion: '2023-11',
          legacyDecorator: false,
          decoratorMetadata: false,
        },
      },
    })
    return { code: result.code, map: result.map }
  },
}

export default defineConfig(() => ({
  devtools: { apply: 'serve' },
  plugins: [
    decoratorPlugin as any,
    {
      name: 'delta-comic:copy-runtime',
      async buildStart() {
        await mkdir(resolve(import.meta.dirname, 'public/runtime'), { recursive: true })
        await copyFile(runtimeFile, appRuntimeFile)
      },
    },
    lazyPlugins(async () => {
      const [
        { exposeHostLibraries },
        { default: tailwindcss },
        { default: legacy },
        { default: vueDevTools },
        { default: VueRouter },
      ] = await Promise.all([
        import('@delta-comic/utils/vite'),
        import('@tailwindcss/vite'),
        import('@vitejs/plugin-legacy'),
        import('vite-plugin-vue-devtools'),
        import('vue-router/vite'),
      ])

      return [
        legacy({ targets: ['ie >= 11'], renderModernChunks: false }),
        VueRouter({
          root: import.meta.dirname,
          dts: resolve(import.meta.dirname, 'typed-router.d.ts'),
        }),
        vueDevTools(),
        tailwindcss(),
        exposeHostLibraries({ entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)) }),
      ]
    }),
  ],
  resolve: {
    conditions: ['delta-comic-workspace', ...defaultClientConditions],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts'],
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: { targets: browserslistToTargets(browserslist('> 5%')) },
  },
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rolldownOptions: { input: { main: resolve(import.meta.dirname, 'index.html') } },
  },
  worker: { format: 'es' },
  base: '/',
  server: {
    port: 5174,
    // Tauri expects a fixed port, fail if that port is not available
    strictPort: true,
    // if the host Tauri is expecting is set, use it
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1422 } : undefined,

    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**', 'src-tauri'],
    },
  },
  run: {
    tasks: {
      'build': {
        command: 'node -e ""',
        dependsOn: skipLibBuild
          ? []
          : [{ task: 'build', from: ['dependencies', 'devDependencies'] }],
        cache: { output: [] },
      },
      'build:app': { command: 'tauri build', cache: false },
      'build:debug': { command: 'tauri build --debug', cache: false },
      'build:local': { command: 'tauri build --debug', cache: false },
      'build:web': {
        command: 'vp build',
        dependsOn: skipLibBuild
          ? []
          : [{ task: 'build', from: 'dependencies' }, '@delta-comic/runtime#build'],
        cache: { output: ['dist/**', 'typed-router.d.ts'] },
      },
      'dev': { command: 'tauri dev', cache: false },
      'dev:web': {
        command: 'vp dev',
        cache: false,
        dependsOn: [{ task: 'build', from: 'dependencies' }, '@delta-comic/runtime#build:dev'],
      },
      'tauri': { command: 'vp exec tauri', cache: false },
      'typecheck': {
        command: [
          'tsrs --fast --runExternalCode --noEmit -p tsconfig.app.json',
          'tsrs --fast --runExternalCode -p tsconfig.node.json --noEmit',
        ],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
    },
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
})).withVue({})