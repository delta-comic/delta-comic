import { IsOptional, IsUnion } from 'typebox'
import type { TSchema } from 'typebox'

import { isAutoIncrementColumn, isJsonColumn, type TableSchema } from './schema.mts'

const pascalCase = (name: string): string =>
  name
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const camelCase = (name: string): string =>
  name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

const singularize = (name: string): string => {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`
  return name.endsWith('s') ? name.slice(0, -1) : name
}

const isPrimitive = (schema: TSchema, type: 'string' | 'integer' | 'number' | 'boolean') =>
  schema.type === type

const tsType = (schema: TSchema): string => {
  const base = tsBaseType(schema)
  return IsOptional(schema) ? `${base} | null` : base
}

const tsBaseType = (schema: TSchema): string => {
  if (isAutoIncrementColumn(schema)) return 'Generated<number>'
  if (isJsonColumn(schema)) return `JSONColumnType<${schema.typeName}>`
  if (isPrimitive(schema, 'string')) return 'string'
  if (isPrimitive(schema, 'integer') || isPrimitive(schema, 'number')) return 'number'
  if (isPrimitive(schema, 'boolean')) return 'number'
  if (IsUnion(schema)) {
    const values = (schema.anyOf ?? []).map(node => (node as { const?: unknown }).const)
    if (values.every(value => typeof value === 'string'))
      return values.map(value => `'${value}'`).join(' | ')
    if (values.every(value => typeof value === 'number')) return values.join(' | ')
  }
  if (schema.type === 'object' || schema.type === 'array') {
    throw new Error(
      `JSON column types must be defined via jsonColumn(); got plain ${JSON.stringify(schema)}`,
    )
  }
  throw new Error(`Unsupported column schema for Kysely type generation: ${JSON.stringify(schema)}`)
}

export const generateTableInterface = (table: TableSchema): string => {
  const interfaceName = `${pascalCase(table.name)}Table`
  const rowTypeName = singularize(pascalCase(table.name))
  const lines = Object.entries(table.columns).map(
    ([name, schema]) =>
      `  ${table.kyselyCamelCase ? camelCase(name) : name}: ${tsType(schema as TSchema)}`,
  )
  return [
    `export interface ${interfaceName} {`,
    ...lines,
    '}',
    '',
    `export type ${rowTypeName} = Selectable<${interfaceName}>`,
    `export type New${rowTypeName} = Insertable<${interfaceName}>`,
    `export type ${rowTypeName}Update = Updateable<${interfaceName}>`,
  ].join('\n')
}