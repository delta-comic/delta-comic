import { defineConfig } from '@vizejs/vite-plugin/vite-plus'

export default defineConfig({
  pack: {
    entry: ['./lib/index.ts', './vite/index.ts'],
    sourcemap: true,
    dts: { tsconfig: './tsconfig.app.json' },
  },
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: ['dist/**'] },
      },
      typecheck: {
        command: [
          'tsrs --fast --runExternalCode -p tsconfig.app.json --noEmit',
          'tsrs --fast --runExternalCode -p tsconfig.node.json --noEmit',
        ],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}).withVue({})