import { hashJson, sha256Hex } from '@/shared/crypto'
import { AppError } from '@/shared/errors'
import { stableStringify } from '@/shared/json'

import { assertSyncCollection, syncCollections } from './collections'
import type { NormalizedSyncOperation, SyncPushOperation } from './sync.types'

export const createEntityVersion = async (input: {
  action: string
  clientChangedAt: number
  collection: string
  dataHash: string
  entityId: string
  opId: string
  terminalUuid: string
}): Promise<string> =>
  await sha256Hex(
    [
      input.collection,
      input.entityId,
      input.action,
      input.dataHash,
      String(input.clientChangedAt),
      input.terminalUuid,
      input.opId,
    ].join('\n'),
  )

export const normalizeOperation = async (
  operation: SyncPushOperation,
  terminalUuid: string,
): Promise<NormalizedSyncOperation> => {
  const collection = assertSyncCollection(operation.collection)
  const action = operation.action
  if (action !== 'upsert' && action !== 'delete') {
    throw new AppError('SYNC_INVALID_OPERATION', 'operation action must be upsert or delete', 400)
  }
  if (!operation.opId || operation.opId.length > 160) {
    throw new AppError(
      'SYNC_INVALID_OPERATION',
      'opId is required and must be at most 160 chars',
      400,
    )
  }
  if (!operation.entityId || operation.entityId.length > 512) {
    throw new AppError(
      'SYNC_INVALID_OPERATION',
      'entityId is required and must be at most 512 chars',
      400,
    )
  }
  if (!Number.isFinite(operation.clientChangedAt) || operation.clientChangedAt <= 0) {
    throw new AppError(
      'SYNC_INVALID_OPERATION',
      'clientChangedAt must be a positive timestamp',
      400,
    )
  }
  if (action === 'upsert' && operation.data === undefined) {
    throw new AppError('SYNC_INVALID_OPERATION', 'upsert operation requires data', 400)
  }

  const dataJson = action === 'delete' ? null : stableStringify(operation.data)
  const dataHash =
    operation.dataHash ?? (await hashJson(action === 'delete' ? null : operation.data))
  if (
    operation.dataHash &&
    dataHash !== (await hashJson(action === 'delete' ? null : operation.data))
  ) {
    throw new AppError('SYNC_DATA_HASH_MISMATCH', 'dataHash does not match operation data', 400)
  }
  const version = await createEntityVersion({
    action,
    clientChangedAt: operation.clientChangedAt,
    collection,
    dataHash,
    entityId: operation.entityId,
    opId: operation.opId,
    terminalUuid,
  })
  return { ...operation, action, collection, dataHash, dataJson, version }
}

export const createSnapshotOperation = async (input: {
  clientChangedAt: number
  collection: string
  row: unknown
  snapshotId: string
}): Promise<SyncPushOperation> => {
  const collection = assertSyncCollection(input.collection)
  const dataHash = await hashJson(input.row)
  const realEntityId = syncCollections[collection].getEntityId(input.row)
  return {
    action: 'upsert',
    clientChangedAt: input.clientChangedAt,
    collection,
    data: input.row,
    dataHash,
    entityId: realEntityId,
    opId: `snapshot:${input.snapshotId}:${collection}:${realEntityId}:${dataHash}`,
  }
}