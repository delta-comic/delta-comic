import { defineConfig } from '@vizejs/vite-plugin/vite-plus'

export default defineConfig({
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    entry: './lib/index.ts',
    dts: { tsconfig: './tsconfig.app.json' },
    sourcemap: true,
  },
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      test: { command: 'vp test run test/lib', cache: { output: [] } },
      typecheck: {
        command: [
          'tsrs --fast --runExternalCode -p tsconfig.app.json --noEmit',
          'tsrs --fast --runExternalCode -p tsconfig.node.json --noEmit',
        ],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}).withVue({})