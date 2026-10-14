import { AppError } from '@/shared/errors'

const assertRecord = (row: unknown, collection: string): Record<string, unknown> => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new AppError('SYNC_INVALID_ROW', `row in ${collection} must be an object`, 400)
  }
  return row as Record<string, unknown>
}

const requireField = (row: Record<string, unknown>, key: string, collection: string): string => {
  const value = row[key]
  if (value === undefined || value === null || value === '') {
    throw new AppError('SYNC_INVALID_ENTITY_ID', `${collection}.${key} is required`, 400)
  }
  return String(value)
}

export const syncCollections = {
  itemStore: {
    applyOrder: 10,
    deleteOrder: 90,
    getEntityId: (input: unknown) =>
      requireField(assertRecord(input, 'itemStore'), 'key', 'itemStore'),
  },
  favouriteCard: {
    applyOrder: 20,
    deleteOrder: 80,
    getEntityId: (input: unknown) =>
      requireField(assertRecord(input, 'favouriteCard'), 'createAt', 'favouriteCard'),
  },
  favouriteItem: {
    applyOrder: 30,
    deleteOrder: 70,
    getEntityId: (input: unknown) => {
      const row = assertRecord(input, 'favouriteItem')
      return `${requireField(row, 'belongTo', 'favouriteItem')}:${requireField(row, 'itemKey', 'favouriteItem')}`
    },
  },
  history: {
    applyOrder: 40,
    deleteOrder: 60,
    getEntityId: (input: unknown) =>
      requireField(assertRecord(input, 'history'), 'itemKey', 'history'),
  },
  recentView: {
    applyOrder: 40,
    deleteOrder: 60,
    getEntityId: (input: unknown) =>
      requireField(assertRecord(input, 'recentView'), 'itemKey', 'recentView'),
  },
  subscribe: {
    applyOrder: 40,
    deleteOrder: 60,
    getEntityId: (input: unknown) => {
      const row = assertRecord(input, 'subscribe')
      return `${requireField(row, 'plugin', 'subscribe')}:${requireField(row, 'key', 'subscribe')}`
    },
  },
  config: {
    applyOrder: 50,
    deleteOrder: 50,
    getEntityId: (input: unknown) =>
      requireField(assertRecord(input, 'config'), 'belongTo', 'config'),
  },
} as const

export type SyncCollectionConfig = (typeof syncCollections)[keyof typeof syncCollections]

export const syncCollectionNames = Object.keys(syncCollections) as Array<
  keyof typeof syncCollections
>

export const isSyncCollection = (value: string): value is keyof typeof syncCollections =>
  value in syncCollections

export const assertSyncCollection = (value: string): keyof typeof syncCollections => {
  if (isSyncCollection(value)) return value
  throw new AppError('SYNC_INVALID_COLLECTION', `unsupported sync collection: ${value}`, 400)
}