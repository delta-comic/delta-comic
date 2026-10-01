import type { Kysely, Selectable } from 'kysely'

import type { PluginDiagnosticLogTable as Table } from './generated/plugin_diagnostic_log.table'

import type { DB } from './index'

export type Level = Table['level']

export type { Table }
export type PluginDiagnosticLog = Selectable<Table>

export interface PluginDiagnosticInput {
  readonly id: string
  readonly pluginId: string
  readonly timestamp: number
  readonly level: Level
  readonly source: string
  readonly message: string
  readonly details?: Record<string, unknown>
  readonly fiberId?: string
  readonly eventId?: string
}

const serializeDetails = (details: Record<string, unknown> | undefined) =>
  details === undefined ? null : JSON.stringify(details)

export const append = async (db: Kysely<DB>, input: PluginDiagnosticInput): Promise<void> => {
  await db
    .insertInto('pluginDiagnosticLog')
    .values({
      id: input.id,
      pluginId: input.pluginId,
      timestamp: input.timestamp,
      level: input.level,
      source: input.source,
      message: input.message,
      details: serializeDetails(input.details),
      fiberId: input.fiberId ?? null,
      eventId: input.eventId ?? null,
    })
    .execute()
  await db
    .deleteFrom('pluginDiagnosticLog')
    .where('pluginId', '=', input.pluginId)
    .where(
      'id',
      'not in',
      db
        .selectFrom('pluginDiagnosticLog')
        .select('id')
        .where('pluginId', '=', input.pluginId)
        .orderBy('timestamp', 'desc')
        .orderBy('id', 'desc')
        .limit(100),
    )
    .execute()
}

export const listRecent = async (
  db: Kysely<DB>,
  pluginId: string,
  limit = 100,
): Promise<readonly PluginDiagnosticLog[]> =>
  await db
    .selectFrom('pluginDiagnosticLog')
    .selectAll()
    .where('pluginId', '=', pluginId)
    .orderBy('timestamp', 'desc')
    .orderBy('id', 'desc')
    .limit(Math.max(1, Math.min(Math.trunc(limit) || 100, 100)))
    .execute()