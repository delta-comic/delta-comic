import { resolve } from 'node:path'

import dts from 'vite-plugin-dts'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [dts({ include: ['./lib'], tsconfigPath: './tsconfig.app.json' })],
  base: '/',
  build: {
    lib: {
      entry: [resolve(__dirname, 'lib/index.ts')],
      name: 'DcVite',
      fileName: 'index',
      formats: ['es']
    },
    sourcemap: true,
    rollupOptions: {
      external: ['vite-plugin-externals', 'vite-plugin-monkey', 'vite', 'rolldown-vite']
    }
  }
})