import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'tsrs --fast --runExternalCode --noEmit -p tsconfig.json',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
      typecheck: {
        command: 'tsrs --fast --runExternalCode --noEmit -p tsconfig.json',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
})