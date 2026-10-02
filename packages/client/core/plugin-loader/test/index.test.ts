import { describe, expect, it } from 'vitest'

import type { LoadedPluginModule, PluginModuleReader, PluginScopeLike } from '../lib'

describe('plugin loader contracts', () => {
  it('accepts a module reader and loaded module contract', async () => {
    const scope: PluginScopeLike = {
      owner: 'example',
      signal: new AbortController().signal,
      defer: () => undefined,
    }
    const module: LoadedPluginModule = {
      factory: () => ({ name: 'example' }),
      activate: () => undefined,
    }
    const reader: PluginModuleReader = {
      id: 'test',
      async read() {
        return module
      },
    }
    expect(
      await reader.read({
        manifest: {
          protocolVersion: 1,
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          entry: 'index.js',
          entryType: 'plugin',
          resources: [],
        },
        source: 'memory',
      }),
    ).toBe(module)
    expect(scope.owner).toBe('example')
  })
})