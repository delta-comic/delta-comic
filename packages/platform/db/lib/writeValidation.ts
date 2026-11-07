import type {
  ColumnNode,
  InsertQueryNode,
  KyselyPlugin,
  OperationNode,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  TableNode,
  UpdateQueryNode,
  UnknownRow,
  ValueNode,
  ValuesNode,
} from 'kysely'
import type { TSchema } from 'typebox'

import { clientCamelRowSchemas } from './generated/schemas'
import { assertWrite } from './validation'

const isTableNode = (node: OperationNode | undefined): node is TableNode =>
  node?.kind === 'TableNode'

const isValuesNode = (node: OperationNode | undefined): node is ValuesNode =>
  node?.kind === 'ValuesNode'

const isValueNode = (node: OperationNode): node is ValueNode => node.kind === 'ValueNode'

const isColumnNode = (node: OperationNode): node is ColumnNode => node.kind === 'ColumnNode'

const tableNameOf = (node: OperationNode | undefined): string | null => {
  if (!isTableNode(node)) return null
  return node.table.identifier.name
}

const rowObjectsOf = (node: InsertQueryNode): readonly unknown[] | null => {
  const columns = node.columns
  if (!columns || columns.length === 0) return null
  const names = columns.map(column => column.column.name)
  const values = node.values
  if (!isValuesNode(values)) return null
  const rows: unknown[] = []
  for (const list of values.values) {
    let entries: unknown[]
    if (list.kind === 'PrimitiveValueListNode') {
      entries = [...list.values]
    } else if (list.kind === 'ValueListNode') {
      const wrapped: unknown[] = []
      for (const entry of list.values) {
        if (!isValueNode(entry)) return null
        wrapped.push(entry.value)
      }
      entries = wrapped
    } else {
      return null
    }
    if (entries.length !== names.length) return null
    rows.push(Object.fromEntries(names.map((name, index) => [name, entries[index]])))
  }
  return rows
}

const updatePatchOf = (node: UpdateQueryNode): Record<string, unknown> | null => {
  if (!node.updates || node.updates.length === 0) return null
  const patch: Record<string, unknown> = {}
  for (const update of node.updates) {
    if (!isColumnNode(update.column)) return null
    const value = update.value
    if (!isValueNode(value)) return null
    patch[update.column.column.name] = value.value
  }
  return patch
}

const partialSchemas = new WeakMap<object, TSchema>()

const partialOf = (schema: TSchema): TSchema => {
  const cached = partialSchemas.get(schema)
  if (cached) return cached
  const partial = { ...schema, required: undefined }
  partialSchemas.set(schema, partial)
  return partial
}

export const validateWriteNode = (node: RootOperationNode): void => {
  let tableName: string | null = null
  let rows: readonly unknown[] | null = null
  let patch: Record<string, unknown> | null = null
  if (node.kind === 'InsertQueryNode') {
    tableName = tableNameOf(node.into)
    rows = rowObjectsOf(node)
  } else if (node.kind === 'UpdateQueryNode') {
    tableName = tableNameOf(node.table)
    patch = updatePatchOf(node)
  } else {
    return
  }
  if (tableName === null) return
  const schema = (clientCamelRowSchemas as Record<string, TSchema>)[tableName]
  if (!schema) return
  if (rows !== null) {
    if (rows.length === 0) return
    for (const row of rows) assertWrite(schema, tableName, row)
    return
  }
  if (patch !== null) {
    assertWrite(partialOf(schema), tableName, patch)
  }
}

/**
 * Centralized write gate: validates every insert/replace/update against the
 * generated camelCase row schema before it reaches the dialect. Registered
 * before CamelCasePlugin, so it observes camelCase identifiers and raw values.
 */
export class WriteValidationPlugin implements KyselyPlugin {
  transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
    validateWriteNode(node)
    return node
  }

  async transformResult({ result }: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return result
  }
}