import {
  Kysely,
  SqliteDialect,
  sql,
  type ColumnDefinitionBuilder,
  type CreateTableBuilder,
  type ForeignKeyConstraintBuilderCallback,
} from 'kysely'
import { IsOptional, IsUnion } from 'typebox'
import type { TSchema } from 'typebox'

import type { TableSchema } from './schema.mts'

const unionValues = (schema: TSchema): readonly (string | number)[] | undefined => {
  if (!IsUnion(schema)) return undefined
  const values = (schema.anyOf ?? []).map(node => (node as { const?: unknown }).const)
  if (values.every(value => typeof value === 'string' || typeof value === 'number'))
    return values as readonly (string | number)[]
  return undefined
}

const isPrimitive = (schema: TSchema, type: 'string' | 'integer' | 'number' | 'boolean') =>
  schema.type === type

const sqliteType = (schema: TSchema): string => {
  if (isPrimitive(schema, 'string')) return 'text'
  if (isPrimitive(schema, 'integer')) return 'integer'
  if (isPrimitive(schema, 'number')) return 'real'
  if (isPrimitive(schema, 'boolean')) return 'integer'
  const values = unionValues(schema)
  if (values !== undefined)
    return values.every(value => typeof value === 'number') ? 'integer' : 'text'
  if (schema.type === 'object' || schema.type === 'array') return 'text'
  throw new Error(`Unsupported column schema for SQL generation: ${JSON.stringify(schema)}`)
}

const isNullable = (schema: TSchema): boolean => IsOptional(schema)

const defaultLiteral = (schema: TSchema): unknown => {
  const value = (schema as { default?: unknown }).default
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string' || typeof value === 'number') return value
  return undefined
}

const checkExpression = (name: string, schema: TSchema): string | undefined => {
  if (isPrimitive(schema, 'boolean')) return `${name} in (0, 1)`
  const values = unionValues(schema)
  if (values !== undefined) {
    const rendered = values
      .map(value => (typeof value === 'string' ? `'${value}'` : `${value}`))
      .join(', ')
    return `${name} in (${rendered})`
  }
  if (isPrimitive(schema, 'integer') || isPrimitive(schema, 'number')) {
    const minimum = (schema as { minimum?: number }).minimum
    const maximum = (schema as { maximum?: number }).maximum
    if (minimum !== undefined && maximum !== undefined)
      return `${name} between ${minimum} and ${maximum}`
    if (minimum !== undefined) return `${name} >= ${minimum}`
    if (maximum !== undefined) return `${name} <= ${maximum}`
  }
  return undefined
}

const columnCallback =
  (
    name: string,
    schema: TSchema,
    primaryKey: boolean,
    unique: boolean,
  ): ((col: ColumnDefinitionBuilder) => ColumnDefinitionBuilder) =>
  col => {
    if (primaryKey) col = col.primaryKey()
    if (unique) col = col.unique()
    if (!isNullable(schema)) col = col.notNull()
    const defaultValue = defaultLiteral(schema)
    if (defaultValue !== undefined) col = col.defaultTo(defaultValue)
    const check = checkExpression(name, schema)
    if (check !== undefined) col = col.check(sql`${sql.raw(check)}`)
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
        name,
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