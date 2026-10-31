import { generateTableInterface } from './kysely.mts'
import {
  camelCase,
  generateCamelCaseRuntimeTableSchema,
  generateRuntimeTableSchema,
  type TableSchema,
} from './schema.mts'
import { generateTableSqlFull } from './sql.mts'

export interface GeneratedArtifacts {
  sql: string
  types: string
  schemas: string
}

const camelCaseName = (name: string): string => camelCase(name)

export const generateTableTypeFile = (table: TableSchema): string => {
  const source = generateTableInterface(table)
  const imports = ['Insertable', 'Selectable', 'Updateable']
  if (source.includes('Generated<')) imports.push('Generated')
  if (source.includes('JSONColumnType<')) imports.push('JSONColumnType')
  const jsonImports = Object.values(table.columns).flatMap(value => {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('typeName' in value) ||
      !('typeImport' in value)
    )
      return []
    const typeImport = value.typeImport
    return typeof value.typeName === 'string' && typeof typeImport === 'string'
      ? [{ name: value.typeName, path: typeImport }]
      : []
  })
  const typeImports = new Map(jsonImports.map(value => [`${value.path}:${value.name}`, value]))
  const importLines = [`import type { ${imports.join(', ')} } from 'kysely'`]
  for (const group of new Set([...typeImports.values()].map(value => value.path))) {
    const names = [...typeImports.values()]
      .filter(value => value.path === group)
      .map(value => value.name)
    importLines.push(`import type { ${names.join(', ')} } from '${group}'`)
  }
  return `${importLines.join('\n')}\n\n${source}`
}

export const generateRuntimeSchemaFile = (
  tables: readonly TableSchema[],
  schemaExportName: string,
): string => {
  const camelTables = tables.filter(table => table.kyselyCamelCase === true)
  const lines: string[] = []
  for (const table of tables) {
    lines.push(
      `/** Runtime SQLite row schema for ${table.name}. */\nexport const ${camelCaseName(table.name)}RowSchema = ${JSON.stringify(generateRuntimeTableSchema(table))} as const`,
    )
  }
  for (const table of camelTables) {
    lines.push(
      `/** Runtime TS-level row schema for ${table.name} (camelCase keys). */\nexport const ${camelCaseName(table.name)}CamelRowSchema = ${JSON.stringify(generateCamelCaseRuntimeTableSchema(table))} as const`,
    )
  }
  const camelMapName = `${schemaExportName.replace(/RowSchemas$/, '')}CamelRowSchemas`
  const camelMap = camelTables.length
    ? `\nexport const ${camelMapName} = {\n${camelTables.map(table => `  '${camelCaseName(table.name)}': ${camelCaseName(table.name)}CamelRowSchema,`).join('\n')}\n} satisfies Record<string, TSchema>`
    : ''
  return `import type { TSchema } from 'typebox'\n\n${lines.join('\n\n')}\n\nexport const ${schemaExportName} = {\n${tables.map(table => `  '${table.name}': ${camelCaseName(table.name)}RowSchema,`).join('\n')}\n} satisfies Record<string, TSchema>${camelMap}`
}

export const generateArtifacts = (
  tables: readonly TableSchema[],
  schemaExportName: string,
): Map<string, string> => {
  const artifacts = new Map<string, string>()
  for (const table of tables) {
    artifacts.set(`${table.name}.sql`, `${generateTableSqlFull(table)}\n`)
    artifacts.set(`${table.name}.table.ts`, generateTableTypeFile(table))
  }
  artifacts.set('schemas.ts', generateRuntimeSchemaFile(tables, schemaExportName))
  return artifacts
}