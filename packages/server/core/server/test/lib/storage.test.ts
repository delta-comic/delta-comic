import { describe, expect, it, vi } from 'vitest'

import { LocalStorageCloudSessionStorage, MemoryCloudSessionStorage } from '../../lib/storage'
import type { CloudSession } from '../../lib/types'

const session: CloudSession = {
  terminal: { terminalUuid: 'terminal-1' },
  tokens: {
    accessExpiresAt: 100,
    accessToken: 'access',
    refreshExpiresAt: 200,
    refreshToken: 'refresh',
  },
  user: { id: 'user-1', loginName: 'alice' },
}

class MapStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('cloud session storage', () => {
  it('stores and clears a memory session', async () => {
    const storage = new MemoryCloudSessionStorage()
    await expect(storage.getSession()).resolves.toBeNull()

    await storage.setSession(session)
    await expect(storage.getSession()).resolves.toBe(session)
    await storage.clearSession()
    await expect(storage.getSession()).resolves.toBeNull()
  })

  it('serializes local sessions under a configurable key', async () => {
    const backing = new MapStorage()
    const storage = new LocalStorageCloudSessionStorage('custom-session', backing)

    await storage.setSession(session)
    expect(backing.values.get('custom-session')).toBe(JSON.stringify(session))
    await expect(storage.getSession()).resolves.toEqual(session)
    await storage.clearSession()
    expect(backing.values.has('custom-session')).toBe(false)
  })

  it('removes corrupted local data and tolerates unavailable browser storage', async () => {
    const backing = new MapStorage()
    backing.setItem('session', '{broken')
    const storage = new LocalStorageCloudSessionStorage('session', backing)

    await expect(storage.getSession()).resolves.toBeNull()
    expect(backing.values.has('session')).toBe(false)

    vi.stubGlobal('localStorage', undefined)
    const unavailable = new LocalStorageCloudSessionStorage('session')
    await expect(unavailable.getSession()).resolves.toBeNull()
    await expect(unavailable.setSession(session)).resolves.toBeUndefined()
    await expect(unavailable.clearSession()).resolves.toBeUndefined()
  })
})