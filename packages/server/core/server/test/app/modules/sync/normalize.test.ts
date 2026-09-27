import { describe, expect, it } from 'vitest'

import { createSnapshotOperation, normalizeOperation } from '../../../../app/modules/sync/normalize'

describe('sync operation normalization', () => {
  it('generates deterministic snapshot op ids', async () => {
    const row = { itemKey: 'comic:1', timestamp: 123, ep: { id: 'ep-1' } }
    const first = await createSnapshotOperation({
      clientChangedAt: 1000,
      collection: 'history',
      row,
      snapshotId: 'snap-1',
    })
    const second = await createSnapshotOperation({
      clientChangedAt: 1000,
      collection: 'history',
      row: { ep: { id: 'ep-1' }, timestamp: 123, itemKey: 'comic:1' },
      snapshotId: 'snap-1',
    })

    expect(first.entityId).toBe('comic:1')
    expect(first.opId).toBe(second.opId)
  })

  it('normalizes upsert payload and creates a version', async () => {
    const normalized = await normalizeOperation(
      {
        action: 'upsert',
        clientChangedAt: 1000,
        collection: 'config',
        data: { data: '{}', form: '{}', belongTo: 'reader' },
        entityId: 'reader',
        opId: 'op-1',
      },
      '00000000-0000-4000-8000-000000000001',
    )

    expect(normalized.dataJson).toBe('{"belongTo":"reader","data":"{}","form":"{}"}')
    expect(normalized.version).toHaveLength(64)
  })
})