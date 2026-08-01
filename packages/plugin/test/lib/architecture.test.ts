import { describe, expect, it } from 'vitest'

const sourceModules = import.meta.glob('../../lib/**/*.ts', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

describe('plugin package architecture', () => {
  it('does not import the package root from inside the package', () => {
    const forbiddenImports = /from\s+["'](?:@\/index|@delta-comic\/plugin)["']/

    for (const [path, source] of Object.entries(sourceModules)) {
      expect(source, `${path} must import the owning module directly`).not.toMatch(forbiddenImports)
    }
  })

  it('keeps the package root as an export-only entry', () => {
    const rootEntry = sourceModules['../../lib/index.ts']
    const executableLine = rootEntry
      ?.split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0 && !line.startsWith('export'))

    expect(executableLine).toBeUndefined()
  })
})