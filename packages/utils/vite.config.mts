import { cloneDeep } from 'es-toolkit'
import { defineConfig } from 'vite-plus'

import { extendsDepends, type ExternalLib } from './lib'

const deps = cloneDeep(extendsDepends) as Partial<ExternalLib>
delete deps['@delta-comic/utils']

export default defineConfig({
  pack: {
    dts: true,
    entry: './lib/index.ts',
    sourcemap: true,
    format: 'es',
    deps: { neverBundle: Object.keys(deps) }
  }
})