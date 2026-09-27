import { CLOUD_SCHEMA_VERSION } from '../constants'
import { CloudClientError } from '../errors'

import { getSyncEntityId, type SyncCollection } from './collections'
import { hashJson, sha256Hex } from './hash'
import type { SyncAction, SyncPushOperation, SyncSnapshotRequest } from './types'

export interface CreateSyncOperationInput {
  action: SyncAction
  baseVersion?: string
  clientChangedAt?: number
  collection: SyncCollection
  data?: unknown
  dataHash?: string
  entityId?: string
  opId?: string
}

const randomId = (): string => {
  const cryptoWithUuid = crypto as Crypto & { randomUUID?: () => string }
  if (typeof cryptoWithUuid.randomUUID === 'function') return cryptoWithUuid.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const createSyncOperation = async (
  input: CreateSyncOperationInput,
): Promise<SyncPushOperation> => {
  if (input.action === 'upsert' && input.data === undefined) {
    throw new CloudClientError('SYNC_INVALID_OPERATION', 'upsert operation requires data')
  }
  const data = input.action === 'delete' ? undefined : input.data
  const dataHash = input.dataHash ?? (await hashJson(input.action === 'delete' ? null : data))
  const entityId = input.entityId ?? getSyncEntityId(input.collection, input.data)
  const clientChangedAt = input.clientChangedAt ?? Date.now()
  const opId =
    input.opId ??
    `op:${clientChangedAt}:${input.collection}:${(await sha256Hex(`${randomId()}:${entityId}:${dataHash}`)).slice(0, 24)}`
  return {
    action: input.action,
    ...(input.baseVersion === undefined ? {} : { baseVersion: input.baseVersion }),
    clientChangedAt,
    collection: input.collection,
    ...(data === undefined ? {} : { data }),
    dataHash,
    entityId,
    opId,
  }
}

export const createSyncSnapshotRequest = (
  collections: SyncSnapshotRequest['collections'],
  snapshotId = `snapshot:${Date.now()}:${randomId()}`,
): SyncSnapshotRequest => ({ collections, schemaVersion: CLOUD_SCHEMA_VERSION, snapshotId })