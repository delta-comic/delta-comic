import { logger } from '@delta-comic/logger'

import { readNumberVar } from '@/env'
import { AppError, isAppError } from '@/shared/errors'
import { parseJson } from '@/shared/json'
import { now as readNow } from '@/shared/time'

import type { AuthContext } from '../auth/auth.types'

import { assertSyncCollection, syncCollectionNames } from './collections'
import { shouldApplyOperation } from './conflict'
import { createSnapshotOperation, normalizeOperation } from './normalize'
import { isProcessingOp, SyncRepository, toReplayedResult } from './sync.repository'
import type {
  NormalizedSyncOperation,
  SyncChange,
  SyncCollection,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItemResult,
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshotRequest,
} from './sync.types'

const syncLogger = logger.scoped('server:sync')

export interface SyncServiceConfig {
  maxPullChanges?: string
  maxPushOps?: string
}

export class SyncService {
  private readonly maxPushOps: number
  private readonly maxPullChanges: number

  constructor(
    private readonly repository: SyncRepository,
    config: SyncServiceConfig,
  ) {
    this.maxPushOps = readNumberVar(config.maxPushOps, 100)
    this.maxPullChanges = readNumberVar(config.maxPullChanges, 500)
  }

  async snapshot(auth: AuthContext, input: SyncSnapshotRequest): Promise<SyncPushResponse> {
    if (input.schemaVersion !== 1)
      throw new AppError('SYNC_SCHEMA_VERSION_UNSUPPORTED', 'unsupported schemaVersion', 400)
    if (!input.snapshotId || input.snapshotId.length > 120) {
      throw new AppError(
        'SYNC_INVALID_SNAPSHOT_ID',
        'snapshotId is required and must be at most 120 chars',
        400,
      )
    }
    const current = readNow()
    const operations = []
    for (const [collectionName, rows] of Object.entries(input.collections)) {
      const collection = assertSyncCollection(collectionName)
      if (!Array.isArray(rows))
        throw new AppError('SYNC_INVALID_SNAPSHOT', `${collection} must be an array`, 400)
      for (const row of rows) {
        operations.push(
          await createSnapshotOperation({
            clientChangedAt: current,
            collection,
            row,
            snapshotId: input.snapshotId,
          }),
        )
      }
    }
    syncLogger.info('sync snapshot prepared', {
      collectionCount: Object.keys(input.collections).length,
      operationCount: operations.length,
    })
    return await this.push(auth, { operations, schemaVersion: 1 })
  }

  async push(auth: AuthContext, input: SyncPushRequest): Promise<SyncPushResponse> {
    if (input.schemaVersion !== 1)
      throw new AppError('SYNC_SCHEMA_VERSION_UNSUPPORTED', 'unsupported schemaVersion', 400)
    if (input.operations.length > this.maxPushOps) {
      throw new AppError(
        'SYNC_BATCH_TOO_LARGE',
        `at most ${this.maxPushOps} operations can be pushed`,
        413,
      )
    }
    syncLogger.debug('sync push started', { operationCount: input.operations.length })
    const results: SyncPushItemResult[] = []
    for (const operation of input.operations) {
      results.push(await this.applyOperation(auth, operation))
    }
    const serverTime = readNow()
    await this.repository.markTerminalPushed({
      lastPushedAt: serverTime,
      terminalUuid: auth.terminalUuid,
      userId: auth.userId,
    })
    const response = {
      checkpoint: { latestSeq: await this.repository.latestSeq(auth.userId), serverTime },
      results,
    }
    syncLogger.debug('sync push completed', {
      appliedCount: results.filter(result => result.result === 'applied').length,
      failedCount: results.filter(result => result.result === 'failed').length,
      operationCount: results.length,
    })
    return response
  }

  async pull(auth: AuthContext, input: SyncPullRequest): Promise<SyncPullResponse> {
    if (!Number.isFinite(input.sinceSeq) || input.sinceSeq < 0) {
      throw new AppError('SYNC_INVALID_CURSOR', 'sinceSeq must be a non-negative number', 400)
    }
    const limit = Math.min(input.limit ?? this.maxPullChanges, this.maxPullChanges)
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new AppError('SYNC_INVALID_LIMIT', 'limit must be a positive number', 400)
    }
    const collections = (input.collections ?? syncCollectionNames).map(assertSyncCollection)
    syncLogger.debug('sync pull started', {
      collectionCount: collections.length,
      limit,
      sinceSeq: input.sinceSeq,
    })
    const rows = await this.repository.pullChanges({
      collections,
      includeOwn: input.includeOwn ?? false,
      limit,
      sinceSeq: input.sinceSeq,
      terminalUuid: auth.terminalUuid,
      userId: auth.userId,
    })
    const latestSeq = await this.repository.latestSeq(auth.userId)
    const nextSeq = rows.at(-1)?.server_seq ?? input.sinceSeq
    await this.repository.upsertCursor({
      lastPulledSeq: nextSeq,
      lastSeenAt: readNow(),
      terminalUuid: auth.terminalUuid,
      userId: auth.userId,
    })
    const response = {
      changes: rows.map(this.toChange),
      checkpoint: {
        hasMore: rows.length === limit && nextSeq < latestSeq,
        latestSeq,
        nextSeq,
        sinceSeq: input.sinceSeq,
      },
    }
    syncLogger.debug('sync pull completed', {
      changeCount: rows.length,
      hasMore: response.checkpoint.hasMore,
      nextSeq,
    })
    return response
  }

  private async applyOperation(
    auth: AuthContext,
    rawOperation: SyncPushRequest['operations'][number],
  ) {
    const receivedAt = readNow()
    let operation: NormalizedSyncOperation
    try {
      operation = await normalizeOperation(rawOperation, auth.terminalUuid)
      const existing = await this.repository.findOperation(
        auth.userId,
        auth.terminalUuid,
        operation.opId,
      )
      if (existing && !isProcessingOp(existing)) return toReplayedResult(existing)
      if (!existing) {
        const claimed = await this.repository.claimOperation({
          operation,
          receivedAt,
          terminalUuid: auth.terminalUuid,
          userId: auth.userId,
        })
        if (!claimed) {
          const replayed = await this.repository.findOperation(
            auth.userId,
            auth.terminalUuid,
            operation.opId,
          )
          if (replayed) return toReplayedResult(replayed)
        }
      }
      return await this.applyClaimedOperation(auth, operation, receivedAt)
    } catch (error) {
      if (isAppError(error)) {
        syncLogger.warn('sync operation rejected', {
          code: error.code,
          collection: rawOperation.collection,
        })
        return {
          collection: rawOperation.collection as SyncCollection,
          entityId: rawOperation.entityId,
          error: { code: error.code, message: error.message },
          opId: rawOperation.opId,
          result: 'failed' as const,
        }
      }
      syncLogger.error('sync operation failed unexpectedly', {
        collection: rawOperation.collection,
        error,
      })
      throw error
    }
  }

  private async applyClaimedOperation(
    auth: AuthContext,
    operation: NormalizedSyncOperation,
    current: number,
  ): Promise<SyncPushItemResult> {
    const currentEntity = await this.repository.findEntity(
      auth.userId,
      operation.collection,
      operation.entityId,
    )
    const operationAlreadyStored =
      currentEntity?.last_op_id === operation.opId &&
      currentEntity.last_terminal_uuid === auth.terminalUuid &&
      currentEntity.version === operation.version
    if (
      !operationAlreadyStored &&
      !shouldApplyOperation({ ...operation, terminalUuid: auth.terminalUuid }, currentEntity)
    ) {
      await this.repository.updateOperationResult({
        entityVersion: currentEntity?.version ?? null,
        opId: operation.opId,
        result: 'ignored_stale',
        serverSeq: null,
        terminalUuid: auth.terminalUuid,
        userId: auth.userId,
      })
      return {
        collection: operation.collection,
        entityId: operation.entityId,
        entityVersion: currentEntity?.version,
        opId: operation.opId,
        result: 'ignored_stale',
      }
    }

    const deletedAt = operation.action === 'delete' ? current : null
    await this.repository.upsertEntity({
      deletedAt,
      operation,
      serverUpdatedAt: current,
      terminalUuid: auth.terminalUuid,
      userId: auth.userId,
    })
    const serverSeq = await this.repository.insertChange({
      deletedAt,
      operation,
      serverChangedAt: current,
      terminalUuid: auth.terminalUuid,
      userId: auth.userId,
    })
    await this.repository.updateOperationResult({
      entityVersion: operation.version,
      opId: operation.opId,
      result: 'applied',
      serverSeq,
      terminalUuid: auth.terminalUuid,
      userId: auth.userId,
    })
    return {
      collection: operation.collection,
      entityId: operation.entityId,
      entityVersion: operation.version,
      opId: operation.opId,
      result: 'applied',
      serverSeq,
    }
  }

  private toChange(row: {
    action: 'upsert' | 'delete'
    client_changed_at: number
    collection: SyncCollection
    data_hash: string
    data_json: string | null
    deleted_at: number | null
    entity_id: string
    origin_op_id: string
    origin_terminal_uuid: string
    server_changed_at: number
    server_seq: number
    version: string
  }): SyncChange {
    return {
      action: row.action,
      clientChangedAt: row.client_changed_at,
      collection: row.collection,
      ...(row.data_json ? { data: parseJson(row.data_json) } : {}),
      dataHash: row.data_hash,
      ...(row.deleted_at === null ? {} : { deletedAt: row.deleted_at }),
      entityId: row.entity_id,
      originOpId: row.origin_op_id,
      originTerminalUuid: row.origin_terminal_uuid,
      serverChangedAt: row.server_changed_at,
      serverSeq: row.server_seq,
      version: row.version,
    }
  }
}

export const createSyncService = (db: D1Database, config: SyncServiceConfig): SyncService =>
  new SyncService(new SyncRepository(db), config)