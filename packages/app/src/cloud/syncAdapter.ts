import { logger } from '@delta-comic/logger'
import { syncCollectionNames, type SyncChange, type SyncCollection } from '@delta-comic/server'

const syncAdapterLogger = logger.scoped('app:cloud:sync-adapter')

type SnapshotCollections = Record<SyncCollection, unknown[]>

const upsertOrder: Record<SyncCollection, number> = {
  itemStore: 10,
  favouriteCard: 20,
  favouriteItem: 30,
  history: 40,
  recentView: 40,
  subscribe: 40,
  config: 50,
}

const deleteOrder: Record<SyncCollection, number> = {
  itemStore: 90,
  favouriteCard: 80,
  favouriteItem: 70,
  history: 60,
  recentView: 60,
  subscribe: 60,
  config: 50,
}

const splitEntityId = (entityId: string): [string, string] => {
  const separator = entityId.indexOf(':')
  if (separator < 0) return [entityId, '']
  return [entityId.slice(0, separator), entityId.slice(separator + 1)]
}

export class DbCloudSyncAdapter {
  async collectSnapshot(): Promise<SnapshotCollections> {
    syncAdapterLogger.info('collecting local sync snapshot')
    const { db } = await import('@delta-comic/db')
    const collections = await Promise.all(
      syncCollectionNames.map(
        async collection =>
          [collection, await db.selectFrom(collection).selectAll().execute()] as const,
      ),
    )
    const snapshot = Object.fromEntries(collections) as SnapshotCollections
    syncAdapterLogger.info('local sync snapshot collected', {
      collectionCount: collections.length,
      rowCount: collections.reduce((count, [, rows]) => count + rows.length, 0),
    })
    return snapshot
  }

  async applyRemoteChanges(changes: SyncChange[]): Promise<void> {
    syncAdapterLogger.info('applying remote sync changes', { changeCount: changes.length })
    const sorted = [...changes].sort((left, right) => {
      const leftOrder =
        left.action === 'delete' ? deleteOrder[left.collection] : upsertOrder[left.collection]
      const rightOrder =
        right.action === 'delete' ? deleteOrder[right.collection] : upsertOrder[right.collection]
      return leftOrder - rightOrder || left.serverSeq - right.serverSeq
    })
    const { DBUtils, db } = await import('@delta-comic/db')
    await DBUtils.withTransition(async trx => {
      for (const change of sorted) {
        if (change.action === 'delete') {
          await this.deleteRemoteChange(trx as never, change)
          continue
        }
        if (change.data === undefined) continue
        await (trx as any).replaceInto(change.collection).values(change.data).execute()
      }
    }, db)
    syncAdapterLogger.info('remote sync changes applied', { changeCount: changes.length })
  }

  private async deleteRemoteChange(
    trx: { deleteFrom: (table: SyncCollection) => any },
    change: SyncChange,
  ): Promise<void> {
    switch (change.collection) {
      case 'itemStore':
        await trx.deleteFrom('itemStore').where('key', '=', change.entityId).execute()
        return
      case 'favouriteCard':
        await trx
          .deleteFrom('favouriteCard')
          .where('createAt', '=', Number(change.entityId))
          .execute()
        return
      case 'favouriteItem': {
        const [belongTo, itemKey] = splitEntityId(change.entityId)
        await trx
          .deleteFrom('favouriteItem')
          .where('belongTo', '=', Number(belongTo))
          .where('itemKey', '=', itemKey)
          .execute()
        return
      }
      case 'history':
        await trx.deleteFrom('history').where('itemKey', '=', change.entityId).execute()
        return
      case 'recentView':
        await trx.deleteFrom('recentView').where('itemKey', '=', change.entityId).execute()
        return
      case 'subscribe': {
        const [plugin, key] = splitEntityId(change.entityId)
        await trx
          .deleteFrom('subscribe')
          .where('plugin', '=', plugin)
          .where('key', '=', key)
          .execute()
        return
      }
      case 'config':
        await trx.deleteFrom('config').where('belongTo', '=', change.entityId).execute()
    }
  }
}