import { describe, expect, it } from 'vitest'

import { Context, Service } from '../lib/index.js'

declare module 'cordis' {
  interface Context {
    dummy: DummyService
  }
}

class DummyService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'dummy')
  }

  ping() {
    return 'pong'
  }
}

describe('@delta-comic/both cordis integration', () => {
  it('mounts service properly', async () => {
    const ctx = new Context()
    await ctx.plugin(DummyService)
    expect(ctx.dummy).toBeDefined()
    expect(ctx.dummy.ping()).toBe('pong')
  })
})