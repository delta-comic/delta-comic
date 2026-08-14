import { fileURLToPath } from 'node:url'

import { transform } from 'esbuild'
import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

const TS_FILE = /\.[cm]?tsx?$/

/**
 * OXC/rolldown 目前只支持 legacy 装饰器降级，标准（Stage 3）装饰器会被原样保留。
 * 这里用 esbuild 将 lib/test 的 TS 源码中的标准装饰器降级为构造期初始化器语义，
 * 与`@field`/`@transform`的设计保持一致（一次性复制到自有可枚举数据属性）。
 */
async function lowerDecorators(code: string) {
  const result = await transform(code, {
    loader: 'ts',
    target: 'es2022',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
  })
  return { code: result.code, map: result.map }
}

function lowerDecoratorsVite(): Plugin {
  return {
    name: 'delta-comic:lower-decorators',
    async transform(code, id) {
      if (!TS_FILE.test(id)) return
      return lowerDecorators(code)
    },
  }
}

const lowerDecoratorsRollup = {
  name: 'delta-comic:lower-decorators',
  async transform(code: string, id: string) {
    if (!TS_FILE.test(id)) return
    return lowerDecorators(code)
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