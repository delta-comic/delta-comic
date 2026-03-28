import { extendsDepends } from '@delta-comic/utils'
import dtsPlugin from 'vite-plugin-dts'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [dtsPlugin({ include: ['./lib'], tsconfigPath: './tsconfig.app.json' })],
  build: {
    lib: { entry: './lib/index.ts', name: 'DcCore', fileName: 'index', formats: ['es'] },
    sourcemap: true,
    rolldownOptions: { external: Object.keys(extendsDepends), output: { globals: extendsDepends } }
  }
})