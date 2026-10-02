import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: {
    entry: ['./lib/index.ts', './lib/vite.ts'],
    alias: { '@': './lib' },
    dts: { tsconfig: './tsconfig.app.json' },
    sourcemap: true,
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./lib', import.meta.url)) } },
  root,
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        cache: { output: ['dist/**'] },
      },
      typecheck: {
        command: ['tsc -p tsconfig.app.json --noEmit', 'tsc -p tsconfig.node.json --noEmit'],
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})