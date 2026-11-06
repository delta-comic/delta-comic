import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { generateArtifacts } from './artifacts'
import type { TableSchema } from './schema'
import { validateTableSchema } from './schema'

const execFileAsync = promisify(execFile)

const isTableSchema = (value: unknown): value is TableSchema =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TableSchema).name === 'string' &&
  typeof (value as TableSchema).columns === 'object' &&
  typeof (value as TableSchema).meta === 'object'

export async function generateCodegen(
  root: string,
  tableFile: string,
  outputDir: string,
): Promise<void> {
  const schemaExportName = tableFile.includes('client.table')
    ? 'clientRowSchemas'
    : 'serverRowSchemas'

  let module: Record<string, unknown>
  try {
    module = await import(pathToFileURL(resolve(root, tableFile)).href)
  } catch (error) {
    throw new Error(`failed to load table definitions from ${tableFile}: ${String(error)}`, {
      cause: error,
    })
  }
  const tables = Object.values(module).flatMap(value => {
    if (isTableSchema(value)) return [value]
    if (Array.isArray(value)) return value.filter(isTableSchema)
    return []
  })

  if (tables.length === 0) throw new Error(`no table definitions found in ${tableFile}`)

  const names = new Set<string>()
  for (const table of tables) {
    validateTableSchema(table)
    if (names.has(table.name)) throw new Error(`duplicate table name "${table.name}"`)
    names.add(table.name)
  }

  const absoluteOutputDir = resolve(root, outputDir)
  await mkdir(absoluteOutputDir, { recursive: true })

  const artifacts = generateArtifacts(tables, schemaExportName)
  const generatedTypeFiles: string[] = []
  for (const [file, content] of artifacts) {
    const filePath = resolve(absoluteOutputDir, file)
    await writeFile(filePath, content)
    if (file.endsWith('.ts')) generatedTypeFiles.push(filePath)
    console.log(`generated ${filePath}`)
  }

  await execFileAsync('vp', ['fmt', '--write', ...generatedTypeFiles], { cwd: root })
}