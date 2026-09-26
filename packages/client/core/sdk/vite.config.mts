import { transform } from '@swc/core'
import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vitest/config'

const lowerDecorators = async (code: string, id: string) => {
  if (!/\.[cm]?tsx?$/.test(id) || id.includes('node_modules')) return
  const result = await transform(code, {
    filename: id,
    sourceMaps: true,
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', decorators: true },
      transform: { decoratorVersion: '2023-11', legacyDecorator: false, decoratorMetadata: false },
    },
  })
  return { code: result.code, map: result.map }
}

const decoratorPlugin: Plugin = { name: 'delta-comic:lower-decorators', transform: lowerDecorators }

export default defineConfig({
  plugins: [decoratorPlugin],
  pack: {
    entry: [
      './lib/index.ts',
      './lib/manifest.ts',
      './lib/runtime.ts',
      './lib/ui.ts',
      './lib/network.ts',
    ],
    sourcemap: true,
    dts: { tsconfig: './tsconfig.json' },
    plugins: [decoratorPlugin],
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