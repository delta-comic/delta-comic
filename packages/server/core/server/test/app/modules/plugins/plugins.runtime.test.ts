import { describe, expect, it } from 'vitest'

import { createAppServerRuntime } from '../../../../app/modules/plugins/plugins.host'

describe('app ServerRuntime factory', () => {
  it('creates a typed runtime with the D1 plugin host', () => {
    const runtime = createAppServerRuntime({} as D1Database, {
      installationId: 'installation-1',
      pluginId: 'demo',
    })

    expect(runtime.host.pluginHost).toBeDefined()
    expect(runtime.host.db).toBeDefined()
    return runtime.dispose()
  })
})