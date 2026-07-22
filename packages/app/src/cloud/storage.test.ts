import { Logger } from '@delta-comic/logger'
import type { CloudSession } from '@delta-comic/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { nativeStore } = vi.hoisted(() => ({ nativeStore: new Map<string, string>() }))
const storageId = (namespace: unknown, key: unknown) => `${String(namespace)}:${String(key)}`

const makeWhereBuilder = (execute: (where: Map<string, unknown>) => unknown) => {
  const where = new Map<string, unknown>()
  const builder = {
    where(column: string, _operator: string, value: unknown) {
      where.set(column, value)
      return builder
    },
    async execute() {
      return execute(where)
    },
    async executeTakeFirst() {
      return execute(where)
    },
  }
  return builder
}

vi.mock('@delta-comic/db', () => ({
  db: {
    deleteFrom: vi.fn(() =>
      makeWhereBuilder(where => {
        nativeStore.delete(storageId(where.get('namespace'), where.get('key')))
      }),
    ),
    replaceInto: vi.fn(() => ({
      values: vi.fn((row: { key: string; namespace: string; value: string }) => ({
        execute: vi.fn(
          async () => void nativeStore.set(storageId(row.namespace, row.key), row.value),
        ),
      })),
    })),
    selectFrom: vi.fn(() => ({
      select: vi.fn(() =>
        makeWhereBuilder(where => {
          const value = nativeStore.get(storageId(where.get('namespace'), where.get('key')))
          return value === undefined ? undefined : { value }
        }),
      ),
    })),
  },
}))

import { DbCloudSessionStorage, DbCloudSyncStorage, getCloudTerminal } from './storage'

const session: CloudSession = {
  terminal: { terminalUuid: 'terminal-1' },
  tokens: {
    accessExpiresAt: 10,
    accessToken: 'access',
    refreshExpiresAt: 20,
    refreshToken: 'refresh',
  },
  user: { id: 'user-1', loginName: 'reader' },
}

describe('cloud database storage', () => {
  beforeEach(() => nativeStore.clear())

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('round-trips and clears a session in the cloud namespace', async () => {
    const storage = new DbCloudSessionStorage()

    await expect(storage.getSession()).resolves.toBeNull()
    await storage.setSession(session)
    expect(nativeStore.get('cloud:session')).toBe(JSON.stringify(session))
    await expect(storage.getSession()).resolves.toEqual(session)

    await storage.clearSession()
    await expect(storage.getSession()).resolves.toBeNull()
  })

  it('treats corrupt session and checkpoint values as absent without leaking parse failures', async () => {
    nativeStore.set('cloud:session', '{not-json')
    nativeStore.set('cloud:sync-checkpoint', 'null')
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    await expect(new DbCloudSessionStorage().getSession()).resolves.toBeNull()
    await expect(new DbCloudSyncStorage().getCheckpoint()).resolves.toBe(0)

    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      'failed to parse cloud storage value',
      expect.any(SyntaxError),
    )
  })

  it('persists and overwrites the latest sync checkpoint', async () => {
    const storage = new DbCloudSyncStorage()

    await storage.setCheckpoint(8)
    await expect(storage.getCheckpoint()).resolves.toBe(8)
    await storage.setCheckpoint(13)

    expect(nativeStore.get('cloud:sync-checkpoint')).toBe('{"latestSeq":13}')
    await expect(storage.getCheckpoint()).resolves.toBe(13)
  })

  it('reuses a persisted terminal id and reports bounded navigator metadata', async () => {
    nativeStore.set('cloud:terminal-uuid', '{"terminalUuid":"persisted-id"}')
    vi.stubGlobal('navigator', { platform: 'TestOS', userAgent: 'x'.repeat(200) })

    await expect(getCloudTerminal()).resolves.toEqual({
      platform: 'TestOS',
      terminalName: 'x'.repeat(128),
      terminalUuid: 'persisted-id',
    })
    expect(nativeStore.get('cloud:terminal-uuid')).toBe('{"terminalUuid":"persisted-id"}')
  })

  it('creates and persists a terminal id once when storage is empty', async () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-id') })
    vi.stubGlobal('navigator', { platform: '', userAgent: '' })

    await expect(getCloudTerminal()).resolves.toEqual({
      platform: 'unknown',
      terminalName: 'Delta Comic',
      terminalUuid: 'generated-id',
    })
    expect(nativeStore.get('cloud:terminal-uuid')).toBe('{"terminalUuid":"generated-id"}')
    await expect(getCloudTerminal()).resolves.toMatchObject({ terminalUuid: 'generated-id' })
    expect(vi.mocked(crypto.randomUUID)).toHaveBeenCalledOnce()
  })
})