import { describe, expect, it } from 'vite-plus/test'

import './setup'

describe('useGlobalVar', () => {
  it('stores values under window.$api.__core_lib__ and reuses existing values by key', async () => {
    const { useGlobalVar } = await import('../../lib/var')
    const initial = { count: 1 }
    const replacement = { count: 2 }

    expect(useGlobalVar(initial, 'state')).toBe(initial)
    expect(useGlobalVar(replacement, 'state')).toBe(initial)
    expect(window.$api.__core_lib__.state).toBe(initial)
  })

  it('keeps different keys isolated', async () => {
    const { useGlobalVar } = await import('../../lib/var')

    expect(useGlobalVar('first', 'a')).toBe('first')
    expect(useGlobalVar('second', 'b')).toBe('second')
    expect(window.$api.__core_lib__).toMatchObject({ a: 'first', b: 'second' })
  })
})