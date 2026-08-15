import { Type } from 'typebox'
import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'
import { Value } from 'typebox/value'

import { AppError } from '@/shared/errors'

const validationDetails = (schema: TSchema, value: unknown) =>
  [...Value.Errors(schema, value)]
    .slice(0, 5)
    .map(error => ({ instancePath: error.instancePath, message: error.message }))

const validators = new WeakMap<object, ReturnType<typeof Compile>>()

const validatorFor = (schema: TSchema) => {
  const cached = validators.get(schema)
  if (cached) return cached
  const validator = Compile(schema)
  validators.set(schema, validator)
  return validator
}

const invalid = (operation: 'read' | 'write', table: string, schema: TSchema, value: unknown) =>
  new AppError(
    'DATABASE_SCHEMA_INVALID',
    `database ${operation} validation failed for ${table}`,
    500,
    { operation, table, errors: validationDetails(schema, value) },
  )

export const assertDatabaseRead = <T>(schema: TSchema, table: string, value: T): T => {
  if (!validatorFor(schema).Check(value)) throw invalid('read', table, schema, value)
  return value
}

export const assertDatabaseWrite = <T>(schema: TSchema, table: string, value: T): T => {
  if (!validatorFor(schema).Check(value)) throw invalid('write', table, schema, value)
  return value
}

export const assertDatabasePatch = <T extends object>(
  schema: TSchema,
  table: string,
  value: T,
): T => {
  const patchSchema = Type.Partial(schema)
  if (!validatorFor(patchSchema).Check(value)) throw invalid('write', table, patchSchema, value)
  return value
}

export const assertDatabaseInsert = <T extends object>(
  schema: TSchema,
  table: string,
  value: T,
  generatedColumns: readonly string[],
): T => {
  const insertSchema = Type.Omit(schema, generatedColumns)
  if (!validatorFor(insertSchema).Check(value)) throw invalid('write', table, insertSchema, value)
  return value
}