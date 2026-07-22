import { logger } from '@delta-comic/logger'

import { getRuntime } from '@/env'

const databaseLogger = logger.scoped('server:database')

export const getDb = (request: Request): D1Database => getRuntime(request).env.DB

export const first = async <T>(
  db: D1Database,
  sql: string,
  ...values: unknown[]
): Promise<T | null> => {
  try {
    const row = await db
      .prepare(sql)
      .bind(...values)
      .first<Record<string, unknown>>()
    return row as T | null
  } catch (error) {
    databaseLogger.error('D1 query failed', { error, operation: 'first' })
    throw error
  }
}

export const all = async <T>(db: D1Database, sql: string, ...values: unknown[]): Promise<T[]> => {
  try {
    const result = await db
      .prepare(sql)
      .bind(...values)
      .all<Record<string, unknown>>()
    return result.results as T[]
  } catch (error) {
    databaseLogger.error('D1 query failed', { error, operation: 'all' })
    throw error
  }
}

export const run = async (
  db: D1Database,
  sql: string,
  ...values: unknown[]
): Promise<D1Result<Record<string, unknown>>> => {
  try {
    return await db
      .prepare(sql)
      .bind(...values)
      .run()
  } catch (error) {
    databaseLogger.error('D1 query failed', { error, operation: 'run' })
    throw error
  }
}