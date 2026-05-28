import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: './lib/index.ts',
    dts: { oxc: true, tsconfig: 'tsconfig.app.json' },
    deps: { alwaysBundle: ['es-toolkit'] },
    sourcemap: true,
  },
})