import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { generateTableInterface } from './kysely.mts'
import { generateRuntimeTableSchema, type TableSchema, validateTableSchema } from './schema.mts'
import { generateTableSqlFull } from './sql.mts'

const root = resolve(import.meta.dirname, '../..')
const definitions = [
  ['script/codegen/server.table.mts', 'packages/server/app/infrastructure/d1/generated'],
  ['script/codegen/client.table.mts', 'packages/db/lib/generated'],
] as const

const isTableSchema = (value: unknown): value is TableSchema =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  'columns' in value &&
  'meta' in value

const generatedTypeSource = (table: TableSchema): string => {
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
    return typeof value.typeName === 'string' && typeof value.typeImport === 'string'
      ? [{ name: value.typeName, path: value.typeImport }]
      : []
  })
  const importLines = [`import type { ${imports.join(', ')} } from 'kysely'`]
  for (const path of new Set(jsonImports.map(value => value.path))) {
    const names = jsonImports.filter(value => value.path === path).map(value => value.name)
    importLines.push(`import type { ${names.join(', ')} } from '${path}'`)
  }
  return `${importLines.join('\n')}\n\n${source}\n`
}

const comparable = (file: string, content: string): string => {
  if (!file.endsWith('.ts')) return content
  const lines = content.split('\n')
  const imports: string[] = []
  while (lines[0]?.startsWith('import ')) imports.push(lines.shift() ?? '')
  return [...imports.sort(), ...lines]
    .join('')
    .replace(/\s+/g, '')
    .replaceAll('"', "'")
    .replaceAll(':|', ':')
}

for (const [definitionPath, outputDir] of definitions) {
  const module = await import(pathToFileURL(resolve(root, definitionPath)).href)
  const tables = Object.values(module).flatMap(value =>
    Array.isArray(value) ? value.filter(isTableSchema) : isTableSchema(value) ? [value] : [],
  )
  const seen = new Set<string>()
  for (const table of tables) {
    validateTableSchema(table)
    if (seen.has(table.name))
      throw new Error(`duplicate table name "${table.name}" in ${definitionPath}`)
    seen.add(table.name)
    const expected = new Map([
      [`${table.name}.sql`, `${generateTableSqlFull(table)}\n`],
      [`${table.name}.table.ts`, generatedTypeSource(table)],
    ])
    for (const [file, content] of expected) {
      const actual = await readFile(resolve(root, outputDir, file), 'utf8')
      if (comparable(file, actual) !== comparable(file, content))
        throw new Error(`generated file is stale: ${outputDir}/${file}`)
    }
  }
  const schemaExportName = definitionPath.includes('client.table')
    ? 'clientRowSchemas'
    : 'serverRowSchemas'
  const schemaPath = resolve(root, outputDir, 'schemas.ts')
  const generatedSchemas = await import(pathToFileURL(schemaPath).href)
  const actualSchemaMap = generatedSchemas[schemaExportName] as Record<string, unknown> | undefined
  if (!actualSchemaMap) throw new Error(`generated file is stale: ${outputDir}/schemas.ts`)
  for (const table of tables) {
    const expectedSchema = generateRuntimeTableSchema(table)
    if (JSON.stringify(actualSchemaMap[table.name]) !== JSON.stringify(expectedSchema))
      throw new Error(`generated file is stale: ${outputDir}/schemas.ts (${table.name})`)
  }
}

console.log('schema consistency check passed')