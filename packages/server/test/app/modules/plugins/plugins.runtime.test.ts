import { describe, expect, it } from 'vitest'

import { createAppServerRuntime } from '../../../../app/modules/plugins/plugins.host'

describe('app ServerRuntime factory', () => {
  it('creates a typed runtime with the legacy D1 host bridge', () => {
    const runtime = createAppServerRuntime({} as D1Database, {
      installationId: 'installation-1',
      pluginId: 'demo',
    })

    expect(runtime.host.legacyPluginHost).toBeDefined()
    expect(runtime.host.db).toBeDefined()
    return runtime.dispose()
  })
})