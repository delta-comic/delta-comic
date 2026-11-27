import { defineConfig } from 'vite-plus'
export default defineConfig({
  pack: { entry: ['lib/modules.ts'], dts: true },
  run: {
    tasks: {
      'build': { command: 'vp pack', cache: { output: ['dist/**'] } },
      'build:dev': { command: 'vp pack', cache: { output: ['dist/**'] } },
      'typecheck': { command: 'tsrs --fast --runExternalCode -p tsconfig.json --noEmit' },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})