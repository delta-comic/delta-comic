import { TypeGuard } from '@sinclair/typebox'
import type { TSchema } from '@sinclair/typebox'

import type { TableSchema } from './schema.mts'

const pascalCase = (name: string): string =>
  name
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const tsType = (schema: TSchema): string => {
  const base = tsBaseType(schema)
  return TypeGuard.IsOptional(schema) ? `${base} | null` : base
}

const tsBaseType = (schema: TSchema): string => {
  if (TypeGuard.IsString(schema)) return 'string'
  if (TypeGuard.IsInteger(schema) || TypeGuard.IsNumber(schema)) return 'number'
  if (TypeGuard.IsBoolean(schema)) return 'number'
  if (TypeGuard.IsObject(schema) || TypeGuard.IsArray(schema)) {
    throw new Error(
      `JSON column types must be defined via jsonColumn(); got plain ${JSON.stringify(schema)}`,
    )
  }
  throw new Error(`Unsupported column schema for Kysely type generation: ${JSON.stringify(schema)}`)
}

export const generateTableInterface = (table: TableSchema): string => {
  const interfaceName = `${pascalCase(table.name)}Table`
  const lines = Object.entries(table.columns).map(
    ([name, schema]) => `  ${name}: ${tsType(schema as TSchema)}`,
  )
  return `export interface ${interfaceName} {\n${lines.join('\n')}\n}`
}