import { extendsDepends } from '@delta-comic/utils'
import dtsPlugin from 'vite-plugin-dts'
import { defineConfig } from 'vite-plus'

import _package from './package.json'

export default defineConfig({
  plugins: [dtsPlugin({ include: ['./lib'], tsconfigPath: './tsconfig.json' })],
  build: {
    lib: { entry: './lib/index.ts', name: 'DcRequest', fileName: 'index', formats: ['es'] },
    sourcemap: true,
    rolldownOptions: { external: Object.keys(extendsDepends), output: { globals: extendsDepends } }
  }
})