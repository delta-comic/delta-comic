import { CloudClientError } from '../errors'

export const syncCollectionNames = [
  'itemStore',
  'favouriteCard',
  'favouriteItem',
  'history',
  'recentView',
  'subscribe',
  'config',
] as const

export type SyncCollection = (typeof syncCollectionNames)[number]

const assertRecord = (row: unknown, collection: SyncCollection): Record<string, unknown> => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new CloudClientError('SYNC_INVALID_ROW', `row in ${collection} must be an object`)
  }
  return row as Record<string, unknown>
}

const requireField = (
  row: Record<string, unknown>,
  key: string,
  collection: SyncCollection,
): string => {
  const value = row[key]
  if (value === undefined || value === null || value === '') {
    throw new CloudClientError('SYNC_INVALID_ENTITY_ID', `${collection}.${key} is required`)
  }
  return String(value)
}

export const isSyncCollection = (value: string): value is SyncCollection =>
  syncCollectionNames.includes(value as SyncCollection)

export const assertSyncCollection = (value: string): SyncCollection => {
  if (isSyncCollection(value)) return value
  throw new CloudClientError('SYNC_INVALID_COLLECTION', `unsupported sync collection: ${value}`)
}

export const getSyncEntityId = (collection: SyncCollection, input: unknown): string => {
  const row = assertRecord(input, collection)
  switch (collection) {
    case 'itemStore':
      return requireField(row, 'key', collection)
    case 'favouriteCard':
      return requireField(row, 'createAt', collection)
    case 'favouriteItem':
      return `${requireField(row, 'belongTo', collection)}:${requireField(row, 'itemKey', collection)}`
    case 'history':
    case 'recentView':
      return requireField(row, 'itemKey', collection)
    case 'subscribe':
      return `${requireField(row, 'plugin', collection)}:${requireField(row, 'key', collection)}`
    case 'config':
      return requireField(row, 'belongTo', collection)
  }
}