import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthContext } from '../../../../app/modules/auth/auth.types'
import type { SyncRepository } from '../../../../app/modules/sync/sync.repository'
import { SyncService } from '../../../../app/modules/sync/sync.service'
import type {
  NormalizedSyncOperation,
  SyncChangeRow,
  SyncEntityRow,
  SyncOpRow,
} from '../../../../app/modules/sync/sync.types'

const auth: AuthContext = {
  loginName: 'alice',
  sessionId: 'session-1',
  terminalUuid: 'terminal-a',
  userId: 'user-1',
}

const rawOperation = {
  action: 'upsert' as const,
  clientChangedAt: 100,
  collection: 'config' as const,
  data: { belongTo: 'core', value: 1 },
  entityId: 'core',
  opId: 'op-1',
}

class MemorySyncRepository {
  operations = new Map<string, SyncOpRow>()
  entities = new Map<string, SyncEntityRow>()
  changes: SyncChangeRow[] = []
  claimResult = true
  latest = 0
  markTerminalPushedCalls: unknown[] = []
  cursorCalls: unknown[] = []
  updateCalls: unknown[] = []

  async findOperation(_userId: string, _terminalUuid: string, opId: string) {
    return this.operations.get(opId) ?? null
  }

  async claimOperation(input: {
    operation: NormalizedSyncOperation
    receivedAt: number
    terminalUuid: string
    userId: string
  }) {
    if (this.claimResult) {
      this.operations.set(input.operation.opId, {
        action: input.operation.action,
        base_version: input.operation.baseVersion ?? null,
        collection: input.operation.collection,
        data_hash: input.operation.dataHash,
        entity_id: input.operation.entityId,
        entity_version: null,
        error_code: 'SYNC_PROCESSING',
        error_message: 'processing',
        op_id: input.operation.opId,
        received_at: input.receivedAt,
        result: 'failed',
        server_seq: null,
        terminal_uuid: input.terminalUuid,
        user_id: input.userId,
      })
    }
    return this.claimResult
  }

  async findEntity(_userId: string, collection: string, entityId: string) {
    return this.entities.get(`${collection}:${entityId}`) ?? null
  }

  async upsertEntity(input: {
    deletedAt: number | null
    operation: NormalizedSyncOperation
    serverUpdatedAt: number
    terminalUuid: string
    userId: string
  }) {
    this.entities.set(`${input.operation.collection}:${input.operation.entityId}`, {
      client_changed_at: input.operation.clientChangedAt,
      collection: input.operation.collection,
      data_hash: input.operation.dataHash,
      data_json: input.operation.dataJson,
      deleted_at: input.deletedAt,
      entity_id: input.operation.entityId,
      last_op_id: input.operation.opId,
      last_terminal_uuid: input.terminalUuid,
      server_updated_at: input.serverUpdatedAt,
      user_id: input.userId,
      version: input.operation.version,
    })
  }

  async insertChange(input: {
    deletedAt: number | null
    operation: NormalizedSyncOperation
    serverChangedAt: number
    terminalUuid: string
    userId: string
  }) {
    const serverSeq = ++this.latest
    this.changes.push({
      action: input.operation.action,
      client_changed_at: input.operation.clientChangedAt,
      collection: input.operation.collection,
      data_hash: input.operation.dataHash,
      data_json: input.operation.dataJson,
      deleted_at: input.deletedAt,
      entity_id: input.operation.entityId,
      origin_op_id: input.operation.opId,
      origin_terminal_uuid: input.terminalUuid,
      server_changed_at: input.serverChangedAt,
      server_seq: serverSeq,
      user_id: input.userId,
      version: input.operation.version,
    })
    return serverSeq
  }

  async updateOperationResult(input: {
    entityVersion: string | null
    opId: string
    result: SyncOpRow['result']
    serverSeq: number | null
    terminalUuid: string
    userId: string
  }) {
    this.updateCalls.push(input)
    const operation = this.operations.get(input.opId)
    if (operation) {
      operation.entity_version = input.entityVersion
      operation.result = input.result
      operation.server_seq = input.serverSeq
      operation.error_code = null
      operation.error_message = null
    }
  }

  async latestSeq() {
    return this.latest
  }

  async pullChanges(input: {
    collections: string[]
    includeOwn: boolean
    limit: number
    sinceSeq: number
    terminalUuid: string
    userId: string
  }) {
    return this.changes
      .filter(change => change.server_seq > input.sinceSeq)
      .filter(change => input.collections.includes(change.collection))
      .filter(change => input.includeOwn || change.origin_terminal_uuid !== input.terminalUuid)
      .slice(0, input.limit)
  }

  async upsertCursor(input: unknown) {
    this.cursorCalls.push(input)
  }

  async markTerminalPushed(input: unknown) {
    this.markTerminalPushedCalls.push(input)
  }
}

const createService = (repository = new MemorySyncRepository()) => ({
  repository,
  service: new SyncService(repository as unknown as SyncRepository, {
    maxPullChanges: '2',
    maxPushOps: '2',
  }),
})

const expectAppError = async (promise: Promise<unknown>, code: string, status: number) => {
  await expect(promise).rejects.toMatchObject({ code, status })
}

describe('SyncService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
  })

  it('applies normalized operations, records checkpoint state, and safely replays them', async () => {
    const { repository, service } = createService()

    const first = await service.push(auth, { operations: [rawOperation], schemaVersion: 1 })
    const replayed = await service.push(auth, { operations: [rawOperation], schemaVersion: 1 })

    expect(first).toMatchObject({
      checkpoint: { latestSeq: 1, serverTime: 1_700_000_000_000 },
      results: [{ entityId: 'core', result: 'applied', serverSeq: 1 }],
    })
    expect(replayed.results).toEqual([
      expect.objectContaining({ entityId: 'core', result: 'replayed', serverSeq: 1 }),
    ])
    expect(repository.changes).toHaveLength(1)
    expect(repository.markTerminalPushedCalls).toHaveLength(2)
  })

  it('returns per-operation validation failures without aborting valid operations', async () => {
    const { repository, service } = createService()
    const result = await service.push(auth, {
      operations: [
        { ...rawOperation, data: undefined },
        { ...rawOperation, entityId: 'other', opId: 'op-2' },
      ],
      schemaVersion: 1,
    })

    expect(result.results).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: 'SYNC_INVALID_OPERATION' }),
        result: 'failed',
      }),
      expect.objectContaining({ entityId: 'other', result: 'applied' }),
    ])
    expect(repository.changes).toHaveLength(1)
  })

  it('rejects unsupported schemas and oversized push batches', async () => {
    const { service } = createService()
    await expectAppError(
      service.push(auth, { operations: [], schemaVersion: 2 as 1 }),
      'SYNC_SCHEMA_VERSION_UNSUPPORTED',
      400,
    )
    await expectAppError(
      service.push(auth, {
        operations: [
          rawOperation,
          { ...rawOperation, opId: 'op-2' },
          { ...rawOperation, opId: 'op-3' },
        ],
        schemaVersion: 1,
      }),
      'SYNC_BATCH_TOO_LARGE',
      413,
    )
  })

  it('replays the winner when another request claims the same operation first', async () => {
    const repository = new MemorySyncRepository()
    repository.claimResult = false
    repository.operations.set(rawOperation.opId, {
      action: 'upsert',
      base_version: null,
      collection: 'config',
      data_hash: 'winner-hash',
      entity_id: 'core',
      entity_version: 'winner-version',
      error_code: null,
      error_message: null,
      op_id: rawOperation.opId,
      received_at: 1,
      result: 'applied',
      server_seq: 8,
      terminal_uuid: auth.terminalUuid,
      user_id: auth.userId,
    })
    let finds = 0
    const originalFind = repository.findOperation.bind(repository)
    repository.findOperation = async (...arguments_: Parameters<typeof originalFind>) => {
      finds += 1
      return finds === 1 ? null : await originalFind(...arguments_)
    }
    const service = new SyncService(repository as unknown as SyncRepository, {})

    const result = await service.push(auth, { operations: [rawOperation], schemaVersion: 1 })

    expect(result.results).toEqual([
      expect.objectContaining({
        entityVersion: 'winner-version',
        result: 'replayed',
        serverSeq: 8,
      }),
    ])
    expect(repository.changes).toHaveLength(0)
  })

  it('recovers processing claims and does not duplicate an already stored entity change', async () => {
    const { repository, service } = createService()
    const first = await service.push(auth, { operations: [rawOperation], schemaVersion: 1 })
    const operation = repository.operations.get(rawOperation.opId)!
    operation.result = 'failed'
    operation.error_code = 'SYNC_PROCESSING'
    operation.error_message = 'interrupted'

    const recovered = await service.push(auth, { operations: [rawOperation], schemaVersion: 1 })

    expect(first.results[0]?.entityVersion).toBeDefined()
    expect(recovered.results[0]).toMatchObject({ result: 'applied', serverSeq: 2 })
    expect(repository.entities).toHaveLength(1)
  })

  it('ignores stale/conflicting writes while recording the current entity version', async () => {
    const { repository, service } = createService()
    await service.push(auth, { operations: [rawOperation], schemaVersion: 1 })

    const stale = await service.push(auth, {
      operations: [
        {
          ...rawOperation,
          clientChangedAt: 50,
          data: { belongTo: 'core', value: 0 },
          opId: 'op-stale',
        },
      ],
      schemaVersion: 1,
    })

    expect(stale.results[0]).toMatchObject({
      entityVersion: repository.entities.get('config:core')?.version,
      result: 'ignored_stale',
    })
    expect(repository.changes).toHaveLength(1)
    expect(repository.updateCalls.at(-1)).toMatchObject({
      result: 'ignored_stale',
      serverSeq: null,
    })
  })

  it('marks deletes with server time and omits deleted data', async () => {
    const { repository, service } = createService()
    const result = await service.push(auth, {
      operations: [{ ...rawOperation, action: 'delete', data: undefined }],
      schemaVersion: 1,
    })

    expect(result.results[0]).toMatchObject({ result: 'applied' })
    expect(repository.entities.get('config:core')).toMatchObject({
      data_json: null,
      deleted_at: 1_700_000_000_000,
    })
  })

  it('turns snapshot rows into stable operations and validates snapshot shape', async () => {
    const { repository, service } = createService()
    const result = await service.snapshot(auth, {
      collections: { config: [{ belongTo: 'core', value: 1 }] },
      schemaVersion: 1,
      snapshotId: 'snapshot-1',
    })

    expect(result.results[0]).toMatchObject({ collection: 'config', entityId: 'core' })
    expect(repository.operations.keys().next().value).toMatch(/^snapshot:snapshot-1:config:core:/)

    await expectAppError(
      service.snapshot(auth, { collections: {}, schemaVersion: 2 as 1, snapshotId: 'x' }),
      'SYNC_SCHEMA_VERSION_UNSUPPORTED',
      400,
    )
    await expectAppError(
      service.snapshot(auth, { collections: {}, schemaVersion: 1, snapshotId: '' }),
      'SYNC_INVALID_SNAPSHOT_ID',
      400,
    )
    await expectAppError(
      service.snapshot(auth, { collections: { unknown: [] }, schemaVersion: 1, snapshotId: 'x' }),
      'SYNC_INVALID_COLLECTION',
      400,
    )
    await expectAppError(
      service.snapshot(auth, {
        collections: { config: {} as unknown as unknown[] },
        schemaVersion: 1,
        snapshotId: 'x',
      }),
      'SYNC_INVALID_SNAPSHOT',
      400,
    )
  })

  it('pulls filtered changes, advances cursors, and reports pagination', async () => {
    const { repository, service } = createService()
    repository.latest = 3
    repository.changes = [1, 2, 3].map(serverSeq => ({
      action: serverSeq === 2 ? ('delete' as const) : ('upsert' as const),
      client_changed_at: serverSeq * 10,
      collection: 'config' as const,
      data_hash: `hash-${serverSeq}`,
      data_json: serverSeq === 2 ? null : JSON.stringify({ value: serverSeq }),
      deleted_at: serverSeq === 2 ? 20 : null,
      entity_id: `entity-${serverSeq}`,
      origin_op_id: `op-${serverSeq}`,
      origin_terminal_uuid: 'terminal-b',
      server_changed_at: serverSeq * 100,
      server_seq: serverSeq,
      user_id: auth.userId,
      version: `version-${serverSeq}`,
    }))

    const result = await service.pull(auth, {
      collections: ['config'],
      includeOwn: false,
      limit: 2,
      schemaVersion: 1,
      sinceSeq: 0,
    })

    expect(result.checkpoint).toEqual({ hasMore: true, latestSeq: 3, nextSeq: 2, sinceSeq: 0 })
    expect(result.changes).toEqual([
      expect.objectContaining({ data: { value: 1 }, serverSeq: 1 }),
      expect.objectContaining({ action: 'delete', deletedAt: 20, serverSeq: 2 }),
    ])
    expect(repository.cursorCalls).toEqual([
      expect.objectContaining({ lastPulledSeq: 2, terminalUuid: auth.terminalUuid }),
    ])
  })

  it('validates pull cursors and limits and preserves the cursor for an empty page', async () => {
    const { repository, service } = createService()
    await expectAppError(service.pull(auth, { sinceSeq: -1 }), 'SYNC_INVALID_CURSOR', 400)
    await expectAppError(service.pull(auth, { limit: 0, sinceSeq: 0 }), 'SYNC_INVALID_LIMIT', 400)

    const result = await service.pull(auth, { sinceSeq: 9 })
    expect(result).toMatchObject({
      changes: [],
      checkpoint: { hasMore: false, nextSeq: 9, sinceSeq: 9 },
    })
    expect(repository.cursorCalls.at(-1)).toMatchObject({ lastPulledSeq: 9 })
  })
})