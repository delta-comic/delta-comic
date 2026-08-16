import { logger } from '@delta-comic/logger'
import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'
import { Value } from 'typebox/value'

import { clientCamelRowSchemas } from './generated/schemas'

const validationLogger = logger.scoped('db:validation')

export type ClientTableName = keyof typeof clientCamelRowSchemas

const validators = new WeakMap<object, ReturnType<typeof Compile>>()

const validatorFor = (schema: TSchema): ReturnType<typeof Compile> => {
  const cached = validators.get(schema)
  if (cached) return cached
  const validator = Compile(schema)
  validators.set(schema, validator)
  return validator
}

const validationDetails = (schema: TSchema, value: unknown) =>
  [...Value.Errors(schema, value)]
    .slice(0, 5)
    .map(error => ({ instancePath: error.instancePath, message: error.message }))

export const tableSchema = <K extends ClientTableName>(table: K) => clientCamelRowSchemas[table]

/** Validates a row before writing; throws to block invalid data from persisting. */
export const assertWrite = <T>(schema: TSchema, table: string, value: T): T => {
  if (!validatorFor(schema).Check(value)) {
    validationLogger.error('database write validation failed', {
      table,
      errors: validationDetails(schema, value),
    })
    throw new Error(
      `database write validation failed for ${table}: ${JSON.stringify(
        validationDetails(schema, value),
      )}`,
    )
  }
  return value
}

export const assertWriteRow = <K extends ClientTableName, T>(table: K, value: T): T =>
  assertWrite(tableSchema(table), table, value)

/** Validates a row on read; failures are non-intrusive: logged and the value returned as-is. */
export const validateRead = <T>(schema: TSchema, table: string, value: T): T => {
  if (!validatorFor(schema).Check(value)) {
    validationLogger.warn('database read validation failed', {
      table,
      errors: validationDetails(schema, value),
    })
  }
  return value
}

export const validateReadRow = <K extends ClientTableName, T>(table: K, value: T): T =>
  validateRead(tableSchema(table), table, value)

/** Filters invalid rows on read; failures are non-intrusive: logged and the row dropped. */
export const filterValidRows = <T>(schema: TSchema, table: string, rows: readonly T[]): T[] => {
  const valid: T[] = []
  for (const row of rows) {
    if (validatorFor(schema).Check(row)) {
      valid.push(row)
      continue
    }
    validationLogger.warn('database read validation failed, row dropped', {
      table,
      errors: validationDetails(schema, row),
    })
  }
  return valid
}

export const filterValidRowsFor = <K extends ClientTableName, T>(
  table: K,
  rows: readonly T[],
): T[] => filterValidRows(tableSchema(table), table, rows)