import { logger } from '@delta-comic/logger'
import type { Kysely, SelectQueryBuilder } from 'kysely'

import type { DB } from '.'

const transactionLogger = logger.scoped('db:transaction')

export const withTransition = async <T>(
  handler: (trx: Kysely<DB>) => Promise<T>,
  trx?: Kysely<DB>,
) => {
  if (trx) return await handler(trx)
  else {
    const { db } = await import('.')
    transactionLogger.trace('database transaction started')
    try {
      const result = await db
        .transaction()
        .setAccessMode('read write')
        .setIsolationLevel('read committed')
        .execute(handler)
      transactionLogger.trace('database transaction committed')
      return result
    } catch (error) {
      transactionLogger.error('database transaction failed', error)
      throw error
    }
  }
}

export async function countDb(sql: SelectQueryBuilder<DB, any, object>) {
  const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
  return v.count
}

export enum CommonQueryKey {
  common = 'db',
}