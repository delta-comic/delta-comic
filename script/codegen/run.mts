import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { generateTableInterface } from './kysely.mts'
import { generateRuntimeTableSchema } from './schema.mts'
import type { TableSchema } from './schema.mts'
import { generateTableSqlFull } from './sql.mts'

const isTableSchema = (value: unknown): value is TableSchema =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TableSchema).name === 'string' &&
  typeof (value as TableSchema).columns === 'object' &&
  typeof (value as TableSchema).meta === 'object'

const [tableFile, outputDir] = process.argv.slice(2)

if (!tableFile || !outputDir) {
  console.error('usage: node script/codegen/run.mts <table-file> <output-dir>')
  process.exit(1)
}

const module = await import(pathToFileURL(resolve(tableFile)).href)
const tables = Object.values(module).flatMap(value => {
  if (isTableSchema(value)) return [value]
  if (Array.isArray(value)) return value.filter(isTableSchema)
  return []
})

if (tables.length === 0) {
  console.error(`no table definitions found in ${tableFile}`)
  process.exit(1)
}

await mkdir(outputDir, { recursive: true })

for (const table of tables) {
  const sqlPath = resolve(outputDir, `${table.name}.sql`)
  const typesPath = resolve(outputDir, `${table.name}.table.ts`)
  await writeFile(sqlPath, `${generateTableSqlFull(table)}\n`)
  const types = generateTableInterface(table)
  const imports = ['Insertable', 'Selectable', 'Updateable']
  if (types.includes('Generated<')) imports.push('Generated')
  if (types.includes('JSONColumnType<')) imports.push('JSONColumnType')
  const jsonImports = Object.values(table.columns)
    .filter(value => typeof value === 'object' && value !== null && 'typeImport' in value)
    .flatMap(value => {
      if (!('typeName' in value) || !('typeImport' in value)) return []
      const typeImport = value.typeImport
      return typeof typeImport === 'string' ? [{ name: value.typeName, path: typeImport }] : []
    })
  const typeImports = new Map(jsonImports.map(value => [`${value.path}:${value.name}`, value]))
  const importLines = [`import type { ${imports.join(', ')} } from 'kysely'`]
  for (const group of new Set([...typeImports.values()].map(value => value.path))) {
    const names = [...typeImports.values()]
      .filter(value => value.path === group)
      .map(value => value.name)
    importLines.push(`import type { ${names.join(', ')} } from '${group}'`)
  }
  await writeFile(typesPath, `${importLines.join('\n')}\n\n${types}\n`)
  console.log(`generated ${sqlPath}`)
  console.log(`generated ${typesPath}`)
}

const schemaPath = resolve(outputDir, 'schemas.ts')
const schemaLines = tables.flatMap(table => [
  `export const ${table.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())}RowSchema = ${JSON.stringify(generateRuntimeTableSchema(table))} as const`,
])
await writeFile(
  schemaPath,
  `import type { TSchema } from 'typebox'\n\n${schemaLines.join('\n')}\n\nexport const serverRowSchemas = {\n${tables.map(table => `  '${table.name}': ${table.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())}RowSchema,`).join('\n')}\n} satisfies Record<string, TSchema>\n`,
)
console.log(`generated ${schemaPath}`)