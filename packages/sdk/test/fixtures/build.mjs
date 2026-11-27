import { resolve } from 'node:path'

import { modulePlugin } from '@delta-comic/client/vite'
import { vize } from '@vizejs/vite-plugin'
import { build } from 'vite-plus'

const root = resolve(process.argv[2])
const parser = root.endsWith('/parser')
await build({
  configFile: false,
  root,
  plugins: [
    vize(),
    modulePlugin(
      parser
        ? {
            id: 'parser',
            name: 'Parser',
            exports: { './text': './text.ts', './lazy': './lazy.ts' },
          }
        : {
            id: 'catalog',
            name: 'Catalog',
            entry: './main.ts',
            exports: { '.': './catalog.ts' },
            pluginPeers: ['@fixture/parser'],
          },
    ),
  ],
})