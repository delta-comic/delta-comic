import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSyncOperation, createSyncSnapshotRequest } from '../../../lib/sync/operations'

describe('cloud sync operation builders', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
  })

  it('derives missing timestamps, ids, hashes, and operation ids for insert-or-update actions', async () => {
    const operation = await createSyncOperation({
      action: 'upsert',
      baseVersion: 'base',
      collection: 'config',
      data: { belongTo: 'core', value: 1 },
    })

    expect(operation).toMatchObject({
      action: 'upsert',
      baseVersion: 'base',
      clientChangedAt: 1_700_000_000_000,
      collection: 'config',
      data: { belongTo: 'core', value: 1 },
      entityId: 'core',
    })
    expect(operation.dataHash).toMatch(/^[a-f0-9]{64}$/)
    expect(operation.opId).toMatch(/^op:1700000000000:config:[a-f0-9]{24}$/)
  })

  it('keeps explicit delete identity while omitting data and optional base version', async () => {
    const operation = await createSyncOperation({
      action: 'delete',
      clientChangedAt: 10,
      collection: 'history',
      data: { ignored: true },
      dataHash: 'explicit-hash',
      entityId: 'comic-1',
      opId: 'op-delete',
    })

    expect(operation).toEqual({
      action: 'delete',
      clientChangedAt: 10,
      collection: 'history',
      dataHash: 'explicit-hash',
      entityId: 'comic-1',
      opId: 'op-delete',
    })
  })

  it('rejects insert-or-update actions without data before deriving an entity id', async () => {
    await expect(
      createSyncOperation({ action: 'upsert', collection: 'config' }),
    ).rejects.toMatchObject({ code: 'SYNC_INVALID_OPERATION' })
  })

  it('creates default and explicit snapshot identifiers at schema version one', () => {
    expect(createSyncSnapshotRequest({ config: [] }, 'snapshot-explicit')).toEqual({
      collections: { config: [] },
      schemaVersion: 1,
      snapshotId: 'snapshot-explicit',
    })
    expect(createSyncSnapshotRequest({ config: [] }).snapshotId).toMatch(/^snapshot:1700000000000:/)
  })
})