import type { syncCollections } from './collections'
import type {
  SyncAction,
  SyncChange,
  SyncOperationResult,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItemResult,
  SyncPushOperation,
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshotRequest,
} from './sync.schemas'

export type SyncCollection = keyof typeof syncCollections
export type {
  SyncAction,
  SyncChange,
  SyncOperationResult,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItemResult,
  SyncPushOperation,
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshotRequest,
}

export interface SyncEntityRow {
  user_id: string
  collection: SyncCollection
  entity_id: string
  data_json: string | null
  data_hash: string
  version: string
  client_changed_at: number
  server_updated_at: number
  deleted_at: number | null
  last_terminal_uuid: string
  last_op_id: string
}

export interface SyncChangeRow {
  server_seq: number
  user_id: string
  collection: SyncCollection
  entity_id: string
  action: SyncAction
  data_json: string | null
  data_hash: string
  version: string
  client_changed_at: number
  server_changed_at: number
  deleted_at: number | null
  origin_terminal_uuid: string
  origin_op_id: string
}

export interface SyncOpRow {
  user_id: string
  terminal_uuid: string
  op_id: string
  collection: SyncCollection
  entity_id: string
  action: SyncAction
  data_hash: string
  base_version: string | null
  result: SyncOperationResult
  server_seq: number | null
  entity_version: string | null
  error_code: string | null
  error_message: string | null
  received_at: number
}

export interface NormalizedSyncOperation extends SyncPushOperation {
  dataJson: string | null
  dataHash: string
  version: string
}