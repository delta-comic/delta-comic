import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

import _package from './package.json'

export default defineConfig({
  plugins: [dts({ include: ['./lib'], tsconfigPath: './tsconfig.json' })],
  base: '/',
  build: {
    lib: { entry: [resolve(__dirname, 'lib/index.ts')], name: 'DcVite', fileName: 'index' },
    sourcemap: true,
    rollupOptions: {
      external: ['vite-plugin-externals', 'vite-plugin-monkey', 'vite', 'rolldown-vite']
    }
  }
})