import type { UniEpRaw } from '@delta-comic/model'
import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'

export interface HistoryTable {
  ep: JSONColumnType<UniEpRaw>
  timestamp: number
  itemKey: string
}

export type History = Selectable<HistoryTable>
export type NewHistory = Insertable<HistoryTable>
export type HistoryUpdate = Updateable<HistoryTable>