import { describe, expectTypeOf, it } from 'vitest'

import type { ExposeModel } from '../../../lib/api'
import { pluginModelChannels } from '../../../lib/capabilities/channels'
import { ContributionHub, type Contribution } from '../../../lib/kernel/contribution'

interface ReaderExpose extends ExposeModel {
  readonly version: 1
  refresh(): Promise<void>
}

declare module '../../../lib' {
  interface PluginExposeRegistry {
    reader: ReaderExpose
  }
}

describe('plugin model channels', () => {
  it('resolves augmented expose contracts by plugin id', () => {
    const registry = new ContributionHub().channel(pluginModelChannels.expose)

    expectTypeOf(registry.get('reader', 'default')).toEqualTypeOf<
      Contribution<ReaderExpose> | undefined
    >()
    expectTypeOf(registry.get('unknown', 'default')).toEqualTypeOf<
      Contribution<ExposeModel> | undefined
    >()
    expectTypeOf(registry.byOwner('reader')).toEqualTypeOf<Contribution<ReaderExpose>[]>()

    void (() => {
      registry.register('reader', 'default', { version: 1, refresh: async () => {} })
      // @ts-expect-error Registered expose values must match the augmented owner contract.
      registry.register('reader', 'default', { version: 2 })
    })
  })
})