import { sql } from 'kysely'

import { createKysely } from '@/infrastructure/d1/kysely'

import type {
  NormalizedSyncOperation,
  SyncAction,
  SyncChangeRow,
  SyncCollection,
  SyncEntityRow,
  SyncOpRow,
  SyncOperationResult,
} from './sync.types'

const PROCESSING_ERROR_CODE = 'SYNC_PROCESSING'

export class SyncRepository {
  private readonly kysely

  constructor(db: D1Database) {
    this.kysely = createKysely(db)
  }

  async findOperation(
    userId: string,
    terminalUuid: string,
    opId: string,
  ): Promise<SyncOpRow | null> {
    return await this.kysely
      .selectFrom('sync_ops')
      .selectAll()
      .where('user_id', '=', userId)
      .where('terminal_uuid', '=', terminalUuid)
      .where('op_id', '=', opId)
      .executeTakeFirst()
      .then(row => row ?? null)
  }

  async claimOperation(input: {
    operation: NormalizedSyncOperation
    receivedAt: number
    terminalUuid: string
    userId: string
  }): Promise<boolean> {
    const result = await this.kysely
      .insertInto('sync_ops')
      .values({
        action: input.operation.action,
        base_version: input.operation.baseVersion ?? null,
        collection: input.operation.collection,
        data_hash: input.operation.dataHash,
        entity_id: input.operation.entityId,
        entity_version: null,
        error_code: PROCESSING_ERROR_CODE,
        error_message: 'operation processing was interrupted before completion',
        op_id: input.operation.opId,
        received_at: input.receivedAt,
        result: 'failed',
        server_seq: null,
        terminal_uuid: input.terminalUuid,
        user_id: input.userId,
      })
      .orIgnore()
      .executeTakeFirst()
    return Number(result.numInsertedOrUpdatedRows ?? 0) > 0
  }

  async findEntity(
    userId: string,
    collection: SyncCollection,
    entityId: string,
  ): Promise<SyncEntityRow | null> {
    return await this.kysely
      .selectFrom('sync_entities')
      .selectAll()
      .where('user_id', '=', userId)
      .where('collection', '=', collection)
      .where('entity_id', '=', entityId)
      .executeTakeFirst()
      .then(row => row ?? null)
  }

  async upsertEntity(input: {
    deletedAt: number | null
    operation: NormalizedSyncOperation
    serverUpdatedAt: number
    terminalUuid: string
    userId: string
  }): Promise<void> {
    await this.kysely
      .insertInto('sync_entities')
      .values({
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
      .onConflict(oc =>
        oc
          .columns(['user_id', 'collection', 'entity_id'])
          .doUpdateSet({
            client_changed_at: input.operation.clientChangedAt,
            data_hash: input.operation.dataHash,
            data_json: input.operation.dataJson,
            deleted_at: input.deletedAt,
            last_op_id: input.operation.opId,
            last_terminal_uuid: input.terminalUuid,
            server_updated_at: input.serverUpdatedAt,
            version: input.operation.version,
          }),
      )
      .execute()
  }

  async insertChange(input: {
    deletedAt: number | null
    operation: NormalizedSyncOperation
    serverChangedAt: number
    terminalUuid: string
    userId: string
  }): Promise<number> {
    const inserted = await this.kysely
      .insertInto('sync_changes')
      .values({
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
        user_id: input.userId,
        version: input.operation.version,
      })
      .orIgnore()
      .returning('server_seq')
      .executeTakeFirst()
    if (inserted) return inserted.server_seq
    const existing = await this.kysely
      .selectFrom('sync_changes')
      .select('server_seq')
      .where('user_id', '=', input.userId)
      .where('origin_terminal_uuid', '=', input.terminalUuid)
      .where('origin_op_id', '=', input.operation.opId)
      .executeTakeFirst()
    return existing?.server_seq ?? 0
  }

  async updateOperationResult(input: {
    entityVersion: string | null
    errorCode?: string | null
    errorMessage?: string | null
    opId: string
    result: SyncOperationResult
    serverSeq: number | null
    terminalUuid: string
    userId: string
  }): Promise<void> {
    await this.kysely
      .updateTable('sync_ops')
      .set({
        entity_version: input.entityVersion,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        result: input.result,
        server_seq: input.serverSeq,
      })
      .where('user_id', '=', input.userId)
      .where('terminal_uuid', '=', input.terminalUuid)
      .where('op_id', '=', input.opId)
      .execute()
  }

  async latestSeq(userId: string): Promise<number> {
    const row = await this.kysely
      .selectFrom('sync_changes')
      .select(sql<number>`coalesce(max(server_seq), 0)`.as('latest_seq'))
      .where('user_id', '=', userId)
      .executeTakeFirst()
    return row?.latest_seq ?? 0
  }

  async pullChanges(input: {
    collections: SyncCollection[]
    includeOwn: boolean
    limit: number
    sinceSeq: number
    terminalUuid: string
    userId: string
  }): Promise<SyncChangeRow[]> {
    let query = this.kysely
      .selectFrom('sync_changes')
      .selectAll()
      .where('user_id', '=', input.userId)
      .where('server_seq', '>', input.sinceSeq)
    if (input.collections.length > 0) query = query.where('collection', 'in', input.collections)
    if (!input.includeOwn) query = query.where('origin_terminal_uuid', '<>', input.terminalUuid)
    return await query.orderBy('server_seq', 'asc').limit(input.limit).execute()
  }

  async upsertCursor(input: {
    lastPulledSeq: number
    lastSeenAt: number
    terminalUuid: string
    userId: string
  }): Promise<void> {
    await this.kysely
      .insertInto('sync_terminal_cursors')
      .values({
        last_pulled_seq: input.lastPulledSeq,
        last_pushed_at: null,
        last_seen_at: input.lastSeenAt,
        terminal_uuid: input.terminalUuid,
        user_id: input.userId,
      })
      .onConflict(oc =>
        oc
          .columns(['user_id', 'terminal_uuid'])
          .doUpdateSet({ last_pulled_seq: input.lastPulledSeq, last_seen_at: input.lastSeenAt }),
      )
      .execute()
  }

  async markTerminalPushed(input: {
    lastPushedAt: number
    terminalUuid: string
    userId: string
  }): Promise<void> {
    await this.kysely
      .insertInto('sync_terminal_cursors')
      .values({
        last_pulled_seq: 0,
        last_pushed_at: input.lastPushedAt,
        last_seen_at: input.lastPushedAt,
        terminal_uuid: input.terminalUuid,
        user_id: input.userId,
      })
      .onConflict(oc =>
        oc
          .columns(['user_id', 'terminal_uuid'])
          .doUpdateSet({ last_pushed_at: input.lastPushedAt, last_seen_at: input.lastPushedAt }),
      )
      .execute()
  }
}

export const isProcessingOp = (row: SyncOpRow): boolean =>
  row.result === 'failed' && row.error_code === PROCESSING_ERROR_CODE

export const toReplayedResult = (row: SyncOpRow) => ({
  collection: row.collection,
  entityId: row.entity_id,
  opId: row.op_id,
  ...(row.error_code && row.error_message
    ? { error: { code: row.error_code, message: row.error_message } }
    : {}),
  ...(row.entity_version ? { entityVersion: row.entity_version } : {}),
  result: row.result === 'applied' ? 'replayed' : row.result,
  ...(row.server_seq === null ? {} : { serverSeq: row.server_seq }),
})

export const actionFromDeletedAt = (deletedAt: number | null): SyncAction =>
  deletedAt === null ? 'upsert' : 'delete'