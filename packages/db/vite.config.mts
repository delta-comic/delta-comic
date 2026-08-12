import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: { dts: { tsconfig: './tsconfig.app.json' }, sourcemap: true, entry: './lib/index.ts' },
  root,
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        output: ['dist/**'],
      },
      typecheck: {
        command: ['tsc -p tsconfig.app.json --noEmit', 'tsc -p tsconfig.node.json --noEmit'],
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        output: [],
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})