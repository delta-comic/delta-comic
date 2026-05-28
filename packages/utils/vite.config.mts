import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: './lib/index.ts',
    sourcemap: true,
    dts: { oxc: true, tsconfig: './tsconfig.app.json' },
  },
})