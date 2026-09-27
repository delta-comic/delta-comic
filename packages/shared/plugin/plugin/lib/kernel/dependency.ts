import type { PluginCandidate } from './candidate'

export interface MissingPluginDependency {
  readonly plugin: string
  readonly dependency: string
}

export interface PluginDependencyPlan {
  readonly levels: PluginCandidate[][]
  readonly missing: MissingPluginDependency[]
  readonly cycles: string[][]
}

const dependenciesOf = (candidate: PluginCandidate) =>
  candidate.manifest.require.map(dependency => dependency.id)

const canonicalCycleKey = (cycle: readonly string[]) => {
  const nodes = cycle.slice(0, -1)
  const rotations = nodes.map((_, index) => nodes.slice(index).concat(nodes.slice(0, index)))
  rotations.sort((left, right) => left.join('\0').localeCompare(right.join('\0')))
  return rotations[0]?.join('\0') ?? ''
}

export const findPluginDependencyCycles = (candidates: readonly PluginCandidate[]) => {
  const candidateIds = new Set(candidates.map(candidate => candidate.manifest.name.id))
  const dependencies = new Map(
    candidates.map(candidate => [
      candidate.manifest.name.id,
      dependenciesOf(candidate).filter(dependency => candidateIds.has(dependency)),
    ]),
  )
  const state = new Map<string, 'visiting' | 'visited'>()
  const path: string[] = []
  const keys = new Set<string>()
  const cycles: string[][] = []

  const visit = (plugin: string) => {
    state.set(plugin, 'visiting')
    path.push(plugin)
    for (const dependency of dependencies.get(plugin) ?? []) {
      if (state.get(dependency) === 'visiting') {
        const start = path.lastIndexOf(dependency)
        if (start < 0) continue
        const cycle = path.slice(start).concat(dependency)
        const key = canonicalCycleKey(cycle)
        if (!keys.has(key)) {
          keys.add(key)
          cycles.push(cycle)
        }
      } else if (state.get(dependency) !== 'visited') {
        visit(dependency)
      }
    }
    path.pop()
    state.set(plugin, 'visited')
  }

  for (const candidate of candidates) {
    const id = candidate.manifest.name.id
    if (!state.has(id)) visit(id)
  }
  return cycles
}

export const planPluginDependencies = (
  candidates: readonly PluginCandidate[],
): PluginDependencyPlan => {
  const byId = new Map(candidates.map(candidate => [candidate.manifest.name.id, candidate]))
  const degree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  const missing: MissingPluginDependency[] = []

  for (const candidate of candidates) {
    const id = candidate.manifest.name.id
    const installed = dependenciesOf(candidate).filter(dependency => {
      if (byId.has(dependency)) return true
      missing.push({ dependency, plugin: id })
      return false
    })
    degree.set(id, installed.length)
    for (const dependency of installed) {
      const entries = dependents.get(dependency) ?? []
      entries.push(id)
      dependents.set(dependency, entries)
    }
  }

  const queue = [...degree].filter(([, value]) => value === 0).map(([id]) => id)
  const levels: PluginCandidate[][] = []
  while (queue.length > 0) {
    const current = queue.splice(0)
    const level = current.flatMap(id => {
      const candidate = byId.get(id)
      return candidate ? [candidate] : []
    })
    if (level.length > 0) levels.push(level)
    for (const id of current) {
      for (const dependent of dependents.get(id) ?? []) {
        const next = (degree.get(dependent) ?? 0) - 1
        degree.set(dependent, next)
        if (next === 0) queue.push(dependent)
      }
    }
  }

  const unresolved = candidates.filter(
    candidate => (degree.get(candidate.manifest.name.id) ?? 0) > 0,
  )
  return { cycles: findPluginDependencyCycles(unresolved), levels, missing }
}