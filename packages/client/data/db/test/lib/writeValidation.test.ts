import type {
  ColumnNode,
  InsertQueryNode,
  SelectQueryNode,
  TableNode,
  UpdateQueryNode,
  ValueNode,
  ValuesNode,
} from 'kysely'
import { describe, expect, it } from 'vite-plus/test'

import { validateWriteNode, WriteValidationPlugin } from '../../lib/writeValidation'

const tableNode = (table: string): TableNode => ({
  kind: 'TableNode',
  table: { kind: 'SchemableIdentifierNode', identifier: { kind: 'IdentifierNode', name: table } },
})

const columnNodes = (columns: string[]): ColumnNode[] =>
  columns.map(column => ({ kind: 'ColumnNode', column: { kind: 'IdentifierNode', name: column } }))

const insertNode = (table: string, columns: string[], rows: unknown[][]): InsertQueryNode => {
  const values: ValuesNode = {
    kind: 'ValuesNode',
    values: rows.map(row => ({ kind: 'PrimitiveValueListNode', values: row })),
  }
  return { kind: 'InsertQueryNode', into: tableNode(table), columns: columnNodes(columns), values }
}

const wrappedInsertNode = (
  table: string,
  columns: string[],
  rows: unknown[][],
): InsertQueryNode => {
  const values: ValuesNode = {
    kind: 'ValuesNode',
    values: rows.map(row => ({ kind: 'ValueListNode', values: row.map(valueNode) })),
  }
  return { kind: 'InsertQueryNode', into: tableNode(table), columns: columnNodes(columns), values }
}

const updateNode = (table: string, patch: Record<string, unknown>): UpdateQueryNode => ({
  kind: 'UpdateQueryNode',
  table: tableNode(table),
  updates: Object.entries(patch).map(([column, value]) => ({
    kind: 'ColumnUpdateNode',
    column: { kind: 'ColumnNode', column: { kind: 'IdentifierNode', name: column } },
    value: { kind: 'ValueNode', value },
  })),
})

const valueNode = (value: unknown): ValueNode => ({ kind: 'ValueNode', value })

const cardColumns = ['createAt', 'description', 'private', 'title']
const validCard = [1, 'desc', true, 'Reading']

const pluginColumns = [
  'installerName',
  'loaderName',
  'pluginName',
  'meta',
  'enable',
  'installInput',
  'displayName',
]
const validPluginRow = ['installer', 'loader', 'p', '{"name":"p"}', true, '', null]

describe('validateWriteNode', () => {
  it('accepts valid insert rows', () => {
    expect(() =>
      validateWriteNode(insertNode('favouriteCard', cardColumns, [validCard])),
    ).not.toThrow()
  })

  it('accepts multi-row inserts', () => {
    expect(() =>
      validateWriteNode(
        insertNode(
          'favouriteItem',
          ['addTime', 'belongTo', 'itemKey'],
          [
            [1, 2, 'k'],
            [2, 2, 'k2'],
          ],
        ),
      ),
    ).not.toThrow()
  })

  it('validates rows wrapped in ValueListNodes', () => {
    expect(() =>
      validateWriteNode(wrappedInsertNode('favouriteCard', cardColumns, [validCard])),
    ).not.toThrow()
    expect(() =>
      validateWriteNode(wrappedInsertNode('favouriteCard', cardColumns, [[1, 'desc', true, 42]])),
    ).toThrow(/database write validation failed for favouriteCard/)
  })

  it('rejects invalid insert rows', () => {
    expect(() =>
      validateWriteNode(insertNode('favouriteCard', cardColumns, [[1, 'desc', true, 42]])),
    ).toThrow(/database write validation failed for favouriteCard/)
  })

  it('skips rows whose value count mismatches the columns', () => {
    expect(() =>
      validateWriteNode(
        insertNode('favouriteCard', cardColumns, [[1, 'desc', true, 'Reading', 1]]),
      ),
    ).not.toThrow()
  })

  it('accepts replace rows with stringified JSON columns', () => {
    expect(() =>
      validateWriteNode(insertNode('plugin', pluginColumns, [validPluginRow])),
    ).not.toThrow()
  })

  it('validates update patches against the partial schema', () => {
    expect(() => validateWriteNode(updateNode('plugin', { enable: true }))).not.toThrow()
    expect(() => validateWriteNode(updateNode('plugin', { installInputs: true }))).toThrow(
      /database write validation failed for plugin/,
    )
  })

  it('skips empty value lists and unknown tables', () => {
    expect(() => validateWriteNode(insertNode('favouriteItem', ['itemKey'], []))).not.toThrow()
    expect(() => validateWriteNode(updateNode('plugin', {}))).not.toThrow()
    expect(() => validateWriteNode(insertNode('future_table', ['a'], [[1]]))).not.toThrow()
  })

  it('skips non-write nodes', () => {
    const select: SelectQueryNode = {
      kind: 'SelectQueryNode',
      selections: [{ kind: 'SelectionNode', selection: { kind: 'SelectAllNode' } }],
    }
    expect(() => validateWriteNode(select)).not.toThrow()
  })
})

describe('WriteValidationPlugin', () => {
  it('validates queries without mutating them and passes results through', async () => {
    const plugin = new WriteValidationPlugin()
    const node = insertNode('favouriteCard', cardColumns, [validCard])
    const queryId = { queryId: 'id-1' }
    expect(plugin.transformQuery({ node, queryId })).toBe(node)
    const row = { createAt: 1, description: 'desc', private: true, title: 'Reading' }
    await expect(plugin.transformResult({ result: { rows: [row] }, queryId })).resolves.toEqual({
      rows: [row],
    })
  })

  it('throws inside transformQuery for invalid writes', () => {
    const plugin = new WriteValidationPlugin()
    expect(() =>
      plugin.transformQuery({
        node: insertNode('favouriteCard', cardColumns, [[1, 'desc', 'yes', 'Reading']]),
        queryId: { queryId: 'id-2' },
      }),
    ).toThrow(/database write validation failed for favouriteCard/)
  })
})