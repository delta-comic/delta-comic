import type { Kysely, SelectQueryBuilder } from 'kysely'

import type { DB } from '.'

export const withTransition = async <T>(
  handler: (trx: Kysely<DB>) => Promise<T>,
  trx?: Kysely<DB>
) => {
  if (trx) return await handler(trx)
  else {
    const { db } = await import('.')
    return await db
      .transaction()
      .setAccessMode('read write')
      .setIsolationLevel('read committed')
      .execute(handler)
  }
}

export async function countDb(sql: SelectQueryBuilder<DB, any, object>) {
  const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
  return v.count
}