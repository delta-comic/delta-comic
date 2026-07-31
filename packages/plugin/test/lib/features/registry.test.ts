import { describe, expect, it } from 'vite-plus/test'

import { createBuiltInPluginRegistry } from '../../../lib/features/registry'
import type { BuiltInPluginDefinition } from '../../../lib/plugin'

const definition = (id: string): BuiltInPluginDefinition => ({
  meta: {
    author: 'test',
    description: id,
    name: { display: id, id },
    require: [],
    version: { plugin: '1.0.0', supportCore: '*' },
  },
  config: () => ({ name: id }),
})

describe('createBuiltInPluginRegistry', () => {
  it('indexes bundled definitions by plugin id', () => {
    const registry = createBuiltInPluginRegistry([definition('core'), definition('reader')])
    expect([...registry.keys()]).toEqual(['core', 'reader'])
  })

  it('rejects duplicate bundled ids', () => {
    expect(() => createBuiltInPluginRegistry([definition('core'), definition('core')])).toThrow(
      'duplicate built-in plugin: core',
    )
  })
})