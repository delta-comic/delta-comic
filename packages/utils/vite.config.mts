import { cloneDeep } from 'es-toolkit'
import { defineConfig } from 'vite'
import dtsPlugin from 'vite-plugin-dts'

import { extendsDepends, type ExternalLib } from './lib'
import _package from './package.json'

const deps = cloneDeep(extendsDepends) as Partial<ExternalLib>
delete deps['@delta-comic/utils']

export default defineConfig({
  plugins: [dtsPlugin({ include: ['./lib'], tsconfigPath: './tsconfig.json' })],
  build: {
    lib: { entry: './lib/index.ts', name: 'DcUtils', fileName: 'index' },
    sourcemap: true,
    rollupOptions: { external: Object.keys(deps), output: { globals: deps } }
  }
})