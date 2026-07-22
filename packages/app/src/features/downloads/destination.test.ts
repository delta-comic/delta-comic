import { describe, expect, it } from 'vite-plus/test'

import { resolveDestinationId } from './destination'
import type { Destination } from './downloaderClient'

const destinations: Destination[] = [
  { id: 'secondary', isDefault: false, kind: 'desktopDirectory', label: 'Secondary' },
  { id: 'default', isDefault: true, kind: 'managed', label: 'Downloads' },
]

describe('resolveDestinationId', () => {
  it('preserves a selected registered destination', () => {
    expect(resolveDestinationId(destinations, 'secondary')).toBe('secondary')
  })

  it('falls back to the default when the selected destination is stale', () => {
    expect(resolveDestinationId(destinations, 'removed')).toBe('default')
  })

  it('falls back to the first registered destination when no default exists', () => {
    expect(resolveDestinationId([destinations[0]!])).toBe('secondary')
    expect(resolveDestinationId([])).toBeUndefined()
  })
})