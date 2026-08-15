import type { Static, TProperties, TSchema } from 'typebox'

export interface IndexColumn<TCols extends TProperties = TProperties> {
  column: keyof TCols & string
  order?: 'ASC' | 'DESC'
}

export interface TableIndex<TCols extends TProperties = TProperties> {
  name: string
  columns: readonly ((keyof TCols & string) | IndexColumn<TCols>)[]
}

export interface TableForeignKey {
  columns: readonly string[]
  refTable: string
  refColumns: readonly string[]
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action' | 'set default'
}

export interface TableMeta<TCols extends TProperties> {
  primaryKey: readonly (keyof TCols & string)[]
  unique?: readonly (readonly (keyof TCols & string)[])[]
  indexes?: readonly TableIndex<TCols>[]
  foreignKeys?: readonly (TableForeignKey & { columns: readonly (keyof TCols & string)[] })[]
}

export interface TableSchema<
  TName extends string = string,
  TCols extends TProperties = TProperties,
> {
  name: TName
  columns: TCols
  meta: TableMeta<TCols>
}

export const defineTable = <TName extends string, TCols extends TProperties>(
  name: TName,
  columns: TCols,
  meta: TableMeta<TCols>,
): TableSchema<TName, TCols> => ({ name, columns, meta })

type DbStatic<T extends TSchema> =
  undefined extends Static<T> ? Exclude<Static<T>, undefined> | null : Static<T>

export type TableRow<T extends TableSchema> = {
  [K in keyof T['columns']]: DbStatic<T['columns'][K]>
}