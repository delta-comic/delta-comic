import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: true,
    format: 'es',
    entry: ['./lib/index.ts'],
    sourcemap: true,
    deps: { neverBundle: ['vite-plugin-externals', 'vite-plugin-monkey'] }
  }
})