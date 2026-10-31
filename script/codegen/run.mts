import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { generateArtifacts } from './artifacts.mts'
import type { TableSchema } from './schema.mts'
import { validateTableSchema } from './schema.mts'

const execFileAsync = promisify(execFile)

const isTableSchema = (value: unknown): value is TableSchema =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TableSchema).name === 'string' &&
  typeof (value as TableSchema).columns === 'object' &&
  typeof (value as TableSchema).meta === 'object'

const [tableFile, outputDir] = process.argv.slice(2)
const schemaExportName = tableFile?.includes('client.table')
  ? 'clientRowSchemas'
  : 'serverRowSchemas'

if (!tableFile || !outputDir) {
  console.error('usage: node script/codegen/run.mts <table-file> <output-dir>')
  process.exit(1)
}

let module: Record<string, unknown>
try {
  module = await import(pathToFileURL(resolve(tableFile)).href)
} catch (error) {
  console.error(`failed to load table definitions from ${tableFile}:`, error)
  process.exit(1)
}
const tables = Object.values(module).flatMap(value => {
  if (isTableSchema(value)) return [value]
  if (Array.isArray(value)) return value.filter(isTableSchema)
  return []
})

if (tables.length === 0) {
  console.error(`no table definitions found in ${tableFile}`)
  process.exit(1)
}

try {
  const names = new Set<string>()
  for (const table of tables) {
    validateTableSchema(table)
    if (names.has(table.name)) throw new Error(`duplicate table name "${table.name}"`)
    names.add(table.name)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

await mkdir(outputDir, { recursive: true })

const artifacts = generateArtifacts(tables, schemaExportName)
const generatedTypeFiles: string[] = []
for (const [file, content] of artifacts) {
  const filePath = resolve(outputDir, file)
  await writeFile(filePath, content)
  if (file.endsWith('.ts')) generatedTypeFiles.push(filePath)
  console.log(`generated ${filePath}`)
}

await execFileAsync('vp', ['fmt', '--write', ...generatedTypeFiles], { stdio: 'inherit' })