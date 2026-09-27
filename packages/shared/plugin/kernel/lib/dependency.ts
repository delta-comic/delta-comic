import type { PluginCandidate } from './candidate'

export interface MissingPluginDependency {
  readonly pluginId: string
  readonly dependencyId: string
}

export interface PluginDependencyPlan {
  readonly levels: readonly (readonly PluginCandidate[])[]
  readonly missing: readonly MissingPluginDependency[]
  readonly cycles: readonly (readonly string[])[]
}

export function findPluginDependencyCycles(candidates: readonly PluginCandidate[]) {
  const byId = new Map(candidates.map(candidate => [candidate.manifest.id, candidate]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cycles: string[][] = []
  const path: string[] = []

  const visit = (id: string) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id)
      cycles.push([...path.slice(start), id])
      return
    }
    if (visited.has(id)) return
    const candidate = byId.get(id)
    if (!candidate) return
    visiting.add(id)
    path.push(id)
    for (const dependency of candidate.manifest.dependencies ?? []) visit(dependency.id)
    path.pop()
    visiting.delete(id)
    visited.add(id)
  }

  for (const candidate of candidates) visit(candidate.manifest.id)
  return cycles
}

export function planPluginDependencies(
  candidates: readonly PluginCandidate[],
): PluginDependencyPlan {
  const byId = new Map(candidates.map(candidate => [candidate.manifest.id, candidate]))
  const missing: MissingPluginDependency[] = []
  for (const candidate of candidates) {
    for (const dependency of candidate.manifest.dependencies ?? []) {
      if (!byId.has(dependency.id))
        missing.push({ pluginId: candidate.manifest.id, dependencyId: dependency.id })
    }
  }
  const cycles = findPluginDependencyCycles(candidates)
  const levels: PluginCandidate[][] = []
  const assigned = new Set<string>()
  while (assigned.size < candidates.length) {
    const level = candidates.filter(candidate => {
      if (assigned.has(candidate.manifest.id)) return false
      return (candidate.manifest.dependencies ?? []).every(dependency =>
        assigned.has(dependency.id),
      )
    })
    if (level.length === 0) break
    levels.push(level)
    for (const candidate of level) assigned.add(candidate.manifest.id)
  }
  return { levels, missing, cycles }
}