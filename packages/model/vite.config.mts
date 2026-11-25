import { defineConfig } from '@vizejs/vite-plugin/vite-plus'
import swc from 'unplugin-swc'

export default defineConfig({
  pack: {
    entry: './lib/index.ts',
    dts: { tsconfig: './tsconfig.app.json' },
    plugins: [
      swc.rolldown({
        tsconfigFile: 'tsconfig.json',
        jsc: {
          externalHelpers: true,
          parser: { syntax: 'typescript', tsx: true, decorators: true },
          transform: { decoratorVersion: '2023-11', useDefineForClassFields: true },
        },
      }),
    ],
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