import Elysia, { t } from 'elysia'

import { apiSuccessSchema } from '@/shared/response'

const collectionSchema = t.UnionEnum([
  'itemStore',
  'favouriteCard',
  'favouriteItem',
  'history',
  'recentView',
  'subscribe',
  'config',
])
const actionSchema = t.UnionEnum(['upsert', 'delete'])
const operationResultSchema = t.UnionEnum([
  'applied',
  'replayed',
  'ignored_stale',
  'conflict',
  'failed',
])

export const syncOperationSchema = t.Object({
  action: actionSchema,
  baseVersion: t.Optional(t.String()),
  clientChangedAt: t.Number(),
  collection: collectionSchema,
  data: t.Optional(t.Any()),
  dataHash: t.Optional(t.String()),
  entityId: t.String({ maxLength: 512, minLength: 1 }),
  opId: t.String({ maxLength: 160, minLength: 1 }),
})

export const syncPushSchema = t.Object({
  operations: t.Array(syncOperationSchema),
  schemaVersion: t.Literal(1),
})

export const syncSnapshotSchema = t.Object({
  collections: t.Record(t.String(), t.Array(t.Any())),
  schemaVersion: t.Literal(1),
  snapshotId: t.String({ maxLength: 120, minLength: 1 }),
})

export const syncPullSchema = t.Object({
  collections: t.Optional(t.Array(collectionSchema)),
  includeOwn: t.Optional(t.Boolean()),
  limit: t.Optional(t.Number()),
  schemaVersion: t.Optional(t.Literal(1)),
  sinceSeq: t.Number({ minimum: 0 }),
})

export const syncPushItemResultSchema = t.Object({
  collection: collectionSchema,
  entityId: t.String(),
  entityVersion: t.Optional(t.String()),
  error: t.Optional(t.Object({ code: t.String(), message: t.String() })),
  opId: t.String(),
  result: operationResultSchema,
  serverSeq: t.Optional(t.Number()),
})

export const syncPushResponseSchema = t.Object({
  checkpoint: t.Object({ latestSeq: t.Number(), serverTime: t.Number() }),
  results: t.Array(syncPushItemResultSchema),
})

export const syncChangeSchema = t.Object({
  action: actionSchema,
  clientChangedAt: t.Number(),
  collection: collectionSchema,
  data: t.Optional(t.Any()),
  dataHash: t.String(),
  deletedAt: t.Optional(t.Number()),
  entityId: t.String(),
  originOpId: t.String(),
  originTerminalUuid: t.String(),
  serverChangedAt: t.Number(),
  serverSeq: t.Number(),
  version: t.String(),
})

export const syncPullResponseSchema = t.Object({
  changes: t.Array(syncChangeSchema),
  checkpoint: t.Object({
    hasMore: t.Boolean(),
    latestSeq: t.Number(),
    nextSeq: t.Number(),
    sinceSeq: t.Number(),
  }),
})

export type SyncAction = typeof actionSchema.static
export type SyncOperationResult = typeof operationResultSchema.static
export type SyncPushOperation = typeof syncOperationSchema.static
export type SyncSnapshotRequest = typeof syncSnapshotSchema.static
export type SyncPushRequest = typeof syncPushSchema.static
export type SyncPullRequest = typeof syncPullSchema.static
export type SyncPushItemResult = typeof syncPushItemResultSchema.static
export type SyncPushResponse = typeof syncPushResponseSchema.static
export type SyncChange = typeof syncChangeSchema.static
export type SyncPullResponse = typeof syncPullResponseSchema.static

export const syncModels = new Elysia({ name: 'dc-sync-models' }).model({
  'Response.SyncPull': apiSuccessSchema(syncPullResponseSchema),
  'Response.SyncPush': apiSuccessSchema(syncPushResponseSchema),
  'Sync.Change': syncChangeSchema,
  'Sync.Operation': syncOperationSchema,
  'Sync.PullRequest': syncPullSchema,
  'Sync.PullResponse': syncPullResponseSchema,
  'Sync.PushItemResult': syncPushItemResultSchema,
  'Sync.PushRequest': syncPushSchema,
  'Sync.PushResponse': syncPushResponseSchema,
  'Sync.SnapshotRequest': syncSnapshotSchema,
})