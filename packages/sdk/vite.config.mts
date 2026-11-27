import { defineConfig } from '@vizejs/vite-plugin/vite-plus'

export default defineConfig({
  pack: {
    entry: ['./lib/index.ts', './lib/vite.ts'],
    sourcemap: true,
    dts: { tsconfig: './tsconfig.json', resolver: 'tsc', compilerOptions: { stripInternal: true } },
    deps: {
      alwaysBundle: [/^@delta-comic\//],
      dts: { alwaysBundle: id => id.startsWith('@delta-comic/') || id.includes('/packages/') },
    },
  },
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }],
        cache: { output: ['dist/**'] },
      },
      typecheck: {
        command: ['tsrs --fast --runExternalCode -p tsconfig.json --noEmit'],
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}).withVue({})