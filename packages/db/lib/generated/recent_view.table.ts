import type { Insertable, Selectable, Updateable } from 'kysely'

export interface RecentViewTable {
  timestamp: number
  itemKey: string
  isViewed: number
}

export type RecentView = Selectable<RecentViewTable>
export type NewRecentView = Insertable<RecentViewTable>
export type RecentViewUpdate = Updateable<RecentViewTable>
