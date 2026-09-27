import { describe, expect, it } from 'vitest'

import { shouldApplyOperation } from '../../../../app/modules/sync/conflict'
import type {
  NormalizedSyncOperation,
  SyncEntityRow,
} from '../../../../app/modules/sync/sync.types'

const current: SyncEntityRow = {
  client_changed_at: 100,
  collection: 'history',
  data_hash: 'old-hash',
  data_json: '{}',
  deleted_at: null,
  entity_id: 'comic:1',
  last_op_id: 'op-a',
  last_terminal_uuid: '00000000-0000-4000-8000-000000000001',
  server_updated_at: 100,
  user_id: 'usr_1',
  version: 'v1',
}

const op = (
  input: Partial<NormalizedSyncOperation & { terminalUuid: string }> = {},
): NormalizedSyncOperation & { terminalUuid: string } => ({
  action: 'upsert',
  clientChangedAt: 101,
  collection: 'history',
  data: {},
  dataHash: 'new-hash',
  dataJson: '{}',
  entityId: 'comic:1',
  opId: 'op-b',
  terminalUuid: '00000000-0000-4000-8000-000000000001',
  version: 'v2',
  ...input,
})

describe('sync conflict policy', () => {
  it('applies newer clientChangedAt and ignores older writes', () => {
    expect(shouldApplyOperation(op(), current)).toBe(true)
    expect(shouldApplyOperation(op({ clientChangedAt: 99 }), current)).toBe(false)
  })

  it('uses terminalUuid then opId as deterministic tie breakers', () => {
    expect(
      shouldApplyOperation(
        op({ clientChangedAt: 100, terminalUuid: '00000000-0000-4000-8000-000000000002' }),
        current,
      ),
    ).toBe(true)
    expect(shouldApplyOperation(op({ clientChangedAt: 100, opId: 'op-z' }), current)).toBe(true)
    expect(shouldApplyOperation(op({ clientChangedAt: 100, opId: 'op-0' }), current)).toBe(false)
  })
})