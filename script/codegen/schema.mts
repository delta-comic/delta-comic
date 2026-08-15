import type { Static, TProperties, TSchema } from 'typebox'

const JSON_COLUMN = Symbol('delta.comic.json-column')

export interface JsonColumn {
  readonly [JSON_COLUMN]: true
  readonly type: 'object'
  readonly typeName: string
}

export const isJsonColumn = (schema: TSchema): schema is JsonColumn =>
  typeof schema === 'object' && schema !== null && JSON_COLUMN in schema

export const jsonColumn = (typeName = 'object'): JsonColumn => ({
  [JSON_COLUMN]: true,
  type: 'object',
  typeName,
})

const AUTOINCREMENT = Symbol('delta.comic.autoincrement')

export interface AutoIncrementColumn extends TSchema {
  readonly [AUTOINCREMENT]: true
  readonly type: 'integer'
}

export const isAutoIncrementColumn = (schema: TSchema): schema is AutoIncrementColumn =>
  typeof schema === 'object' && schema !== null && AUTOINCREMENT in schema

export const autoIncrement = (): AutoIncrementColumn => ({ [AUTOINCREMENT]: true, type: 'integer' })

export interface IndexColumn<TCols extends TProperties = TProperties> {
  column: keyof TCols & string
  order?: 'ASC' | 'DESC'
}

export interface TableIndex<TCols extends TProperties = TProperties> {
  name: string
  columns: readonly ((keyof TCols & string) | IndexColumn<TCols>)[]
  unique?: boolean
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
  [K in keyof T['columns']]: T['columns'][K] extends JsonColumn
    ? undefined extends Static<T['columns'][K]>
      ? string | null
      : string
    : DbStatic<T['columns'][K]>
}