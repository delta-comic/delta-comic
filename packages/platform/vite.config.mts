import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'tsrs --fast --runExternalCode -p tsconfig.build.json',
        cache: { output: ['dist/**'] },
      },
      typecheck: { command: 'tsrs --fast --runExternalCode -p tsconfig.json --noEmit' },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})