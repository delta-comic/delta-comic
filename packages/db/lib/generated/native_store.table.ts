import type { Insertable, Selectable, Updateable } from 'kysely'

export interface NativeStoreTable {
  namespace: string
  key: string
  value: string
}

export type NativeStore = Selectable<NativeStoreTable>
export type NewNativeStore = Insertable<NativeStoreTable>
export type NativeStoreUpdate = Updateable<NativeStoreTable>