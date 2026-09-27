import { describe, expect, it } from 'vitest'

import {
  actionFromDeletedAt,
  isProcessingOp,
  SyncRepository,
  toReplayedResult,
} from '../../../../app/modules/sync/sync.repository'
import type {
  NormalizedSyncOperation,
  SyncChangeRow,
  SyncEntityRow,
  SyncOpRow,
} from '../../../../app/modules/sync/sync.types'
import { D1Recorder } from '../../d1'

const operation: NormalizedSyncOperation = {
  action: 'upsert',
  baseVersion: 'base-version',
  clientChangedAt: 10,
  collection: 'config',
  data: { belongTo: 'core' },
  dataHash: 'data-hash',
  dataJson: '{"belongTo":"core"}',
  entityId: 'core',
  opId: 'op-1',
  version: 'version-1',
}

const opRow: SyncOpRow = {
  action: 'upsert',
  base_version: operation.baseVersion ?? null,
  collection: operation.collection,
  data_hash: operation.dataHash,
  entity_id: operation.entityId,
  entity_version: operation.version,
  error_code: null,
  error_message: null,
  op_id: operation.opId,
  received_at: 20,
  result: 'applied',
  server_seq: 7,
  terminal_uuid: 'terminal-1',
  user_id: 'user-1',
}

const changeRow: SyncChangeRow = {
  action: operation.action,
  client_changed_at: operation.clientChangedAt,
  collection: operation.collection,
  data_hash: operation.dataHash,
  data_json: operation.dataJson,
  deleted_at: null,
  entity_id: operation.entityId,
  origin_op_id: operation.opId,
  origin_terminal_uuid: 'terminal-1',
  server_changed_at: 20,
  server_seq: 7,
  user_id: 'user-1',
  version: operation.version,
}

describe('SyncRepository', () => {
  it('finds and atomically claims operations using the processing sentinel', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push(opRow)
    recorder.runResults.push({ changes: 1 }, { changes: 0 })
    const repository = new SyncRepository(recorder.db)

    await expect(repository.findOperation('user-1', 'terminal-1', 'op-1')).resolves.toEqual(opRow)
    await expect(
      repository.claimOperation({
        operation,
        receivedAt: 20,
        terminalUuid: 'terminal-1',
        userId: 'user-1',
      }),
    ).resolves.toBe(true)
    await expect(
      repository.claimOperation({
        operation,
        receivedAt: 21,
        terminalUuid: 'terminal-1',
        userId: 'user-1',
      }),
    ).resolves.toBe(false)

    expect(recorder.statements[0]?.values).toEqual(['user-1', 'terminal-1', 'op-1'])
    expect(recorder.statements[1]?.values).toEqual([
      operation.action,
      operation.baseVersion,
      operation.collection,
      operation.dataHash,
      operation.entityId,
      null,
      'SYNC_PROCESSING',
      'operation processing was interrupted before completion',
      operation.opId,
      20,
      'failed',
      null,
      'terminal-1',
      'user-1',
    ])
  })

  it('finds and saves entities with all conflict-resolution fields', async () => {
    const entity: SyncEntityRow = {
      client_changed_at: 10,
      collection: 'config',
      data_hash: operation.dataHash,
      data_json: operation.dataJson,
      deleted_at: null,
      entity_id: 'core',
      last_op_id: 'op-1',
      last_terminal_uuid: 'terminal-1',
      server_updated_at: 30,
      user_id: 'user-1',
      version: operation.version,
    }
    const recorder = new D1Recorder()
    recorder.firstResults.push(entity)
    const repository = new SyncRepository(recorder.db)

    await expect(repository.findEntity('user-1', 'config', 'core')).resolves.toEqual(entity)
    await repository.upsertEntity({
      deletedAt: null,
      operation,
      serverUpdatedAt: 30,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    })

    expect(recorder.statements[0]?.values).toEqual(['user-1', 'config', 'core'])
    expect(recorder.statements[1]?.sql).toContain(
      'on conflict ("user_id", "collection", "entity_id")',
    )
    expect(recorder.statements[1]?.values).toEqual([
      operation.clientChangedAt,
      operation.collection,
      operation.dataHash,
      operation.dataJson,
      null,
      operation.entityId,
      operation.opId,
      'terminal-1',
      30,
      'user-1',
      operation.version,
      operation.clientChangedAt,
      operation.dataHash,
      operation.dataJson,
      null,
      operation.opId,
      'terminal-1',
      30,
      operation.version,
    ])
  })

  it('returns inserted change sequence or resolves the idempotent existing sequence', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push({ server_seq: 4 }, null, { server_seq: 5 }, null, null)
    const repository = new SyncRepository(recorder.db)
    const input = {
      deletedAt: null,
      operation,
      serverChangedAt: 30,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    }

    await expect(repository.insertChange(input)).resolves.toBe(4)
    await expect(repository.insertChange(input)).resolves.toBe(5)
    await expect(repository.insertChange(input)).resolves.toBe(0)

    expect(recorder.statements[0]?.values).toEqual([
      operation.action,
      operation.clientChangedAt,
      operation.collection,
      operation.dataHash,
      operation.dataJson,
      null,
      operation.entityId,
      operation.opId,
      'terminal-1',
      30,
      'user-1',
      operation.version,
    ])
    expect(recorder.statements[2]).toMatchObject({ values: ['user-1', 'terminal-1', 'op-1'] })
  })

  it('persists terminal operation results and latest sequence defaults', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push({ latest_seq: 9 }, null)
    const repository = new SyncRepository(recorder.db)

    await repository.updateOperationResult({
      entityVersion: operation.version,
      errorCode: 'ERROR',
      errorMessage: 'message',
      opId: operation.opId,
      result: 'failed',
      serverSeq: null,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    })
    await expect(repository.latestSeq('user-1')).resolves.toBe(9)
    await expect(repository.latestSeq('missing')).resolves.toBe(0)

    expect(recorder.statements[0]?.values).toEqual([
      operation.version,
      'ERROR',
      'message',
      'failed',
      null,
      'user-1',
      'terminal-1',
      operation.opId,
    ])
  })

  it('builds pull queries for collection and own-terminal filters', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([changeRow], [])
    const repository = new SyncRepository(recorder.db)

    await repository.pullChanges({
      collections: ['config', 'history'],
      includeOwn: false,
      limit: 20,
      sinceSeq: 3,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    })
    await repository.pullChanges({
      collections: [],
      includeOwn: true,
      limit: 5,
      sinceSeq: 0,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    })

    expect(recorder.statements[0]?.sql).toContain('"collection" in (?, ?)')
    expect(recorder.statements[0]?.sql).toContain('"origin_terminal_uuid" <> ?')
    expect(recorder.statements[0]?.values).toEqual([
      'user-1',
      3,
      'config',
      'history',
      'terminal-1',
      20,
    ])
    expect(recorder.statements[1]?.sql).not.toContain('"collection" in')
    expect(recorder.statements[1]?.sql).not.toContain('"origin_terminal_uuid" <>')
    expect(recorder.statements[1]?.values).toEqual(['user-1', 0, 5])
  })

  it('saves pull and push cursor timestamps independently', async () => {
    const recorder = new D1Recorder()
    const repository = new SyncRepository(recorder.db)

    await repository.upsertCursor({
      lastPulledSeq: 8,
      lastSeenAt: 40,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    })
    await repository.markTerminalPushed({
      lastPushedAt: 50,
      terminalUuid: 'terminal-1',
      userId: 'user-1',
    })

    expect(recorder.statements[0]?.values).toEqual([8, null, 40, 'terminal-1', 'user-1', 8, 40])
    expect(recorder.statements[1]?.values).toEqual([0, 50, 50, 'terminal-1', 'user-1', 50, 50])
  })
})

describe('sync repository result helpers', () => {
  it('recognizes only interrupted processing rows and maps applied rows to replayed', () => {
    expect(isProcessingOp({ ...opRow, error_code: 'SYNC_PROCESSING', result: 'failed' })).toBe(true)
    expect(isProcessingOp(opRow)).toBe(false)
    expect(toReplayedResult(opRow)).toEqual({
      collection: 'config',
      entityId: 'core',
      entityVersion: operation.version,
      opId: 'op-1',
      result: 'replayed',
      serverSeq: 7,
    })
    expect(
      toReplayedResult({
        ...opRow,
        entity_version: null,
        error_code: 'FAILED',
        error_message: 'broken',
        result: 'failed',
        server_seq: null,
      }),
    ).toEqual({
      collection: 'config',
      entityId: 'core',
      error: { code: 'FAILED', message: 'broken' },
      opId: 'op-1',
      result: 'failed',
    })
    expect(actionFromDeletedAt(null)).toBe('upsert')
    expect(actionFromDeletedAt(1)).toBe('delete')
  })
})