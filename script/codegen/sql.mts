import { TypeGuard } from '@sinclair/typebox'
import type { TSchema } from '@sinclair/typebox'
import {
  Kysely,
  SqliteDialect,
  type ColumnDefinitionBuilder,
  type CreateTableBuilder,
  type ForeignKeyConstraintBuilderCallback,
} from 'kysely'

import type { TableSchema } from './schema.mts'

const sqliteType = (schema: TSchema): string => {
  if (TypeGuard.IsString(schema)) return 'text'
  if (TypeGuard.IsInteger(schema)) return 'integer'
  if (TypeGuard.IsNumber(schema)) return 'real'
  if (TypeGuard.IsBoolean(schema)) return 'integer'
  if (TypeGuard.IsObject(schema) || TypeGuard.IsArray(schema)) return 'text'
  throw new Error(`Unsupported column schema for SQL generation: ${JSON.stringify(schema)}`)
}

const isNullable = (schema: TSchema): boolean => TypeGuard.IsOptional(schema)

const columnCallback =
  (
    schema: TSchema,
    primaryKey: boolean,
    unique: boolean,
  ): ((col: ColumnDefinitionBuilder) => ColumnDefinitionBuilder) =>
  col => {
    if (primaryKey) col = col.primaryKey()
    if (unique) col = col.unique()
    if (!isNullable(schema)) col = col.notNull()
    return col
  }

const foreignKeyCallback =
  (onDelete?: string): ForeignKeyConstraintBuilderCallback =>
  builder => {
    if (onDelete) return builder.onDelete(onDelete as never)
    return builder
  }

// 仅供生成 SQL 使用，compile 阶段不会触碰 database
const db = new Kysely({ dialect: new SqliteDialect({ database: {} }) })

export const generateTableSql = (table: TableSchema): string => {
  const { columns, meta } = table
  const primaryKey = meta.primaryKey
  const uniqueGroups = meta.unique ?? []
  const isSingleColumn = (group: readonly string[], name: string) =>
    group.length === 1 && group[0] === name

  let builder: CreateTableBuilder<any, any> = db.schema.createTable(table.name).ifNotExists()
  for (const name of Object.keys(columns)) {
    const schema = columns[name] as TSchema
    builder = builder.addColumn(
      name,
      sqliteType(schema),
      columnCallback(
        schema,
        isSingleColumn(primaryKey, name),
        uniqueGroups.some(group => isSingleColumn(group, name)),
      ),
    )
  }
  if (primaryKey.length > 1) {
    builder = builder.addPrimaryKeyConstraint(`pk_${table.name}`, primaryKey)
  }
  for (const group of uniqueGroups) {
    if (group.length > 1)
      builder = builder.addUniqueConstraint(`uq_${table.name}_${group.join('_')}`, group)
  }
  for (const fk of meta.foreignKeys ?? []) {
    builder = builder.addForeignKeyConstraint(
      `fk_${table.name}_${fk.columns.join('_')}`,
      fk.columns,
      fk.refTable,
      fk.refColumns,
      foreignKeyCallback(fk.onDelete),
    )
  }
  return builder.compile().sql
}

export const generateIndexSql = (table: TableSchema): string[] =>
  (table.meta.indexes ?? []).map(index => {
    let builder = db.schema.createIndex(index.name).ifNotExists().on(table.name)
    for (const column of index.columns) {
      builder =
        typeof column === 'string'
          ? builder.column(column)
          : builder.column(
              column.order ? `${column.column} ${column.order.toLowerCase()}` : column.column,
            )
    }
    return builder.compile().sql
  })

export const generateTableSqlFull = (table: TableSchema): string => {
  const statements = [generateTableSql(table), ...generateIndexSql(table)]
  return statements.join(';\n')
}