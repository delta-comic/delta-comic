import { fileURLToPath } from 'node:url'

import { transform } from '@swc/core'
import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

const TS_FILE = /\.[cm]?tsx?$/

/**
 * OXC/rolldown 目前只支持 legacy 装饰器降级，标准（Stage 3）装饰器会被原样保留。
 * 参照 Vite 官方迁移文档的 SWC Workaround，用`@swc/core`把标准装饰器降级为
 * 2023-11 规范语义（构造期初始化器），与`@field`/`@transform`的设计保持一致。
 */
async function lowerDecorators(code: string, id: string) {
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

function lowerDecoratorsVite(): Plugin {
  return {
    name: 'delta-comic:lower-decorators',
    async transform(code, id) {
      if (!TS_FILE.test(id) || id.includes('node_modules')) return
      return lowerDecorators(code, id)
    },
  }
}

const lowerDecoratorsRollup = {
  name: 'delta-comic:lower-decorators',
  async transform(code: string, id: string) {
    if (!TS_FILE.test(id) || id.includes('node_modules')) return
    return lowerDecorators(code, id)
  },
}

export default defineConfig({
  plugins: [lowerDecoratorsVite()],
  pack: {
    entry: './lib/index.ts',
    dts: { tsconfig: './tsconfig.app.json' },
    plugins: [lowerDecoratorsRollup],
  },
  root,
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: ['dist/**'],
      },
      typecheck: {
        command: ['tsc -p tsconfig.app.json --noEmit', 'tsc -p tsconfig.node.json --noEmit'],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        output: [],
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})