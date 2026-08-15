import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { generateTableInterface } from './kysely.mts'
import type { TableSchema } from './schema.mts'
import { generateTableSql } from './sql.mts'

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
const tables = Object.values(module).filter(isTableSchema)

if (tables.length === 0) {
  console.error(`no table definitions found in ${tableFile}`)
  process.exit(1)
}

await mkdir(outputDir, { recursive: true })

for (const table of tables) {
  const sqlPath = resolve(outputDir, `${table.name}.sql`)
  const typesPath = resolve(outputDir, `${table.name}.table.ts`)
  await writeFile(sqlPath, `${generateTableSql(table)}\n`)
  await writeFile(typesPath, `${generateTableInterface(table)}\n`)
  console.log(`generated ${sqlPath}`)
  console.log(`generated ${typesPath}`)
}