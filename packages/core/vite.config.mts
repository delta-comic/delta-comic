import { extendsDepends } from '@delta-comic/utils'
import { defineConfig } from 'vite'
import dtsPlugin from 'vite-plugin-dts'

import _package from './package.json'

export default defineConfig({
  plugins: [dtsPlugin({ include: ['./lib'], tsconfigPath: './tsconfig.json' })],
  build: {
    lib: { entry: './lib/index.ts', name: 'DcCore', fileName: 'index' },
    sourcemap: true,
    rollupOptions: { external: Object.keys(extendsDepends), output: { globals: extendsDepends } }
  }
})