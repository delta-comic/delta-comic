import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: { entry: ['./lib/index.ts'], sourcemap: true, dts: { tsconfig: './tsconfig.json' } },
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: ['dist/**'] },
      },
      typecheck: {
        command: 'tsc -p tsconfig.json --noEmit',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})