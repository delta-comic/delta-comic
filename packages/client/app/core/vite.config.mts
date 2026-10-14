import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'vue-tsc -p tsconfig.json --noEmit',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
      typecheck: {
        command: 'vue-tsc -p tsconfig.json --noEmit',
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