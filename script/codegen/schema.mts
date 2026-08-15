import { IsOptional, IsUnion, Type } from 'typebox'
import type { Static, TProperties, TSchema } from 'typebox'

const JSON_COLUMN = Symbol('delta.comic.json-column')

export interface JsonColumn {
  readonly [JSON_COLUMN]: true
  readonly type: 'object'
  readonly typeName: string
  readonly typeImport?: string
}

export const isJsonColumn = (schema: TSchema): schema is JsonColumn =>
  typeof schema === 'object' && schema !== null && JSON_COLUMN in schema

export const jsonColumn = (typeName = 'object', typeImport?: string): JsonColumn => ({
  [JSON_COLUMN]: true,
  type: 'object',
  typeName,
  ...(typeImport ? { typeImport } : {}),
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
  kyselyCamelCase?: boolean
}

export const defineTable = <TName extends string, TCols extends TProperties>(
  name: TName,
  columns: TCols,
  meta: TableMeta<TCols>,
  options?: Pick<TableSchema<TName, TCols>, 'kyselyCamelCase'>,
): TableSchema<TName, TCols> => ({ name, columns, meta, ...options })

const databaseColumnSchema = (schema: TSchema): TSchema => {
  const base = schema.type === 'boolean' ? Type.Integer() : schema
  return IsOptional(schema) ? Type.Union([base, Type.Null()]) : base
}

export const generateTableRowSchema = (table: TableSchema): TSchema =>
  Type.Object(
    Object.fromEntries(
      Object.entries(table.columns).map(([name, schema]) => [name, databaseColumnSchema(schema)]),
    ),
  )

const runtimeSchema = (schema: TSchema): Record<string, unknown> => {
  if (isJsonColumn(schema)) return { type: 'string' }
  if (isAutoIncrementColumn(schema)) return { type: 'integer' }
  if (schema.type === 'boolean') return { type: 'integer' }
  if (IsUnion(schema)) {
    return { anyOf: (schema.anyOf ?? []).map(node => runtimeSchema(node)) }
  }
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== 'default' && !key.startsWith('~')),
  )
}

export const generateRuntimeTableSchema = (table: TableSchema): Record<string, unknown> => ({
  type: 'object',
  properties: Object.fromEntries(
    Object.entries(table.columns).map(([name, schema]) => [
      name,
      runtimeSchema(databaseColumnSchema(schema)),
    ]),
  ),
  required: Object.keys(table.columns),
  additionalProperties: false,
})

type DbStatic<T extends TSchema> =
  undefined extends Static<T> ? Exclude<Static<T>, undefined> | null : Static<T>

export type TableRow<T extends TableSchema> = {
  [K in keyof T['columns']]: T['columns'][K] extends JsonColumn
    ? undefined extends Static<T['columns'][K]>
      ? string | null
      : string
    : DbStatic<T['columns'][K]>
}