import type { SyncCollection } from './collections'

export type { SyncCollection } from './collections'

export type SyncAction = 'upsert' | 'delete'

export type SyncOperationResult = 'applied' | 'replayed' | 'ignored_stale' | 'conflict' | 'failed'

export interface SyncPushOperation {
  action: SyncAction
  baseVersion?: string
  clientChangedAt: number
  collection: SyncCollection
  data?: unknown
  dataHash?: string
  entityId: string
  opId: string
}

export interface SyncPushRequest {
  operations: SyncPushOperation[]
  schemaVersion: 1
}

export interface SyncSnapshotRequest {
  collections: Record<string, unknown[]>
  schemaVersion: 1
  snapshotId: string
}

export interface SyncPullRequest {
  collections?: SyncCollection[]
  includeOwn?: boolean
  limit?: number
  schemaVersion?: 1
  sinceSeq: number
}

export interface SyncPushItemResult {
  collection: SyncCollection
  entityId: string
  entityVersion?: string
  error?: { code: string; message: string }
  opId: string
  result: SyncOperationResult
  serverSeq?: number
}

export interface SyncPushResponse {
  checkpoint: { latestSeq: number; serverTime: number }
  results: SyncPushItemResult[]
}

export interface SyncChange {
  action: SyncAction
  clientChangedAt: number
  collection: SyncCollection
  data?: unknown
  dataHash: string
  deletedAt?: number
  entityId: string
  originOpId: string
  originTerminalUuid: string
  serverChangedAt: number
  serverSeq: number
  version: string
}

export interface SyncPullResponse {
  changes: SyncChange[]
  checkpoint: { hasMore: boolean; latestSeq: number; nextSeq: number; sinceSeq: number }
}