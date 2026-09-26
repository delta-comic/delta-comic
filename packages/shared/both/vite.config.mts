import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: [
      './lib/index.ts',
      './lib/manifest.ts',
      './lib/diagnostic.ts',
      './lib/artifact.ts',
      './lib/runtime.ts',
    ],
    sourcemap: true,
    dts: { tsconfig: './tsconfig.json' },
  },
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: ['dist/**'],
      },
      typecheck: {
        command: ['tsc -p tsconfig.json --noEmit'],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: [],
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})