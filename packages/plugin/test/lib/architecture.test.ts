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

  it('keeps the public api independent from host implementation layers', () => {
    const implementationLayer = /(^|\/)(?:adapters|builtins|install|kernel|module|runtime)(\/|$)/

    for (const [path, source] of Object.entries(sourceModules)) {
      if (!path.includes('/lib/api/')) continue
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1])
      expect(
        imports.filter(specifier => implementationLayer.test(specifier)),
        `${path} must contain protocol definitions only`,
      ).toEqual([])
    }
  })

  it('keeps kernel and capabilities independent from higher layers', () => {
    const rules = [
      {
        forbidden: new Set([
          'adapters',
          'builtins',
          'capabilities',
          'install',
          'module',
          'runtime',
        ]),
        path: '/lib/kernel/',
      },
      {
        forbidden: new Set(['adapters', 'builtins', 'install', 'module', 'runtime']),
        path: '/lib/capabilities/',
      },
      {
        forbidden: new Set(['adapters', 'builtins', 'capabilities', 'module', 'runtime']),
        path: '/lib/install/',
      },
    ]

    for (const [path, source] of Object.entries(sourceModules)) {
      const rule = rules.find(candidate => path.includes(candidate.path))
      if (!rule) continue
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1])
      const forbidden = imports.filter(specifier =>
        specifier.split('/').some(segment => rule.forbidden.has(segment)),
      )
      expect(forbidden, `${path} crosses its allowed dependency boundary`).toEqual([])
    }
  })

  it('uses glob imports only for homogeneous built-in discovery', () => {
    for (const [path, source] of Object.entries(sourceModules)) {
      if (!source.includes('import.meta.glob')) continue
      expect(path).toContain('/lib/builtins/')
    }
  })
})