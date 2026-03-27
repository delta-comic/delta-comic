import { cloneDeep } from 'es-toolkit'
import dtsPlugin from 'vite-plugin-dts'
import { defineConfig } from 'vite-plus'

// @ts-ignore
import { extendsDepends, type ExternalLib } from './lib'

const deps = cloneDeep(extendsDepends) as Partial<ExternalLib>
delete deps['@delta-comic/utils']

export default defineConfig({
  plugins: [dtsPlugin({ include: ['./lib'], tsconfigPath: './tsconfig.json' })],
  build: {
    lib: { entry: './lib/index.ts', name: 'DcUtils', fileName: 'index', formats: ['es'] },
    sourcemap: true,
    rollupOptions: { external: Object.keys(deps), output: { globals: deps } }
  }
})