import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { generateArtifacts } from './artifacts.mts'
import {
  camelCase,
  generateCamelCaseRuntimeTableSchema,
  generateRuntimeTableSchema,
  type TableSchema,
  validateTableSchema,
} from './schema.mts'

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
  }
  const schemaExportName = definitionPath.includes('client.table')
    ? 'clientRowSchemas'
    : 'serverRowSchemas'
  const expectedArtifacts = generateArtifacts(tables, schemaExportName)
  for (const [file, expectedContent] of expectedArtifacts) {
    const actualPath = resolve(root, outputDir, file)
    if (file === 'schemas.ts') {
      const generatedModule = await import(pathToFileURL(actualPath).href)
      const actualSchemaMap = generatedModule[schemaExportName] as
        | Record<string, unknown>
        | undefined
      if (!actualSchemaMap) throw new Error(`generated file is stale: ${outputDir}/${file}`)
      for (const table of tables) {
        const expectedSchema = generateRuntimeTableSchema(table)
        if (JSON.stringify(actualSchemaMap[table.name]) !== JSON.stringify(expectedSchema))
          throw new Error(`generated file is stale: ${outputDir}/${file} (${table.name})`)
        if (table.kyselyCamelCase !== true) continue
        const camelMapName = `${schemaExportName.replace(/RowSchemas$/, '')}CamelRowSchemas`
        const actualCamelMap = generatedModule[camelMapName] as Record<string, unknown> | undefined
        if (!actualCamelMap) throw new Error(`generated file is stale: ${outputDir}/${file}`)
        const expectedCamelSchema = generateCamelCaseRuntimeTableSchema(table)
        if (
          JSON.stringify(actualCamelMap[camelCase(table.name)]) !==
          JSON.stringify(expectedCamelSchema)
        )
          throw new Error(`generated file is stale: ${outputDir}/${file} (${table.name} camelCase)`)
      }
    } else {
      const actualContent = await readFile(actualPath, 'utf8')
      const normalize = (content: string) => {
        if (!file.endsWith('.ts')) return content
        const lines = content.split('\n')
        const imports: string[] = []
        const rest: string[] = []
        for (const line of lines) {
          if (line.startsWith('import ')) imports.push(line)
          else rest.push(line)
        }
        return [...imports.sort(), ...rest]
          .join('')
          .replace(/\s+/g, '')
          .replace(/:\|/g, ':')
          .replace(/"/g, "'")
      }
      if (normalize(actualContent) !== normalize(expectedContent))
        throw new Error(`generated file is stale: ${outputDir}/${file}`)
    }
  }
}

console.log('schema consistency check passed')