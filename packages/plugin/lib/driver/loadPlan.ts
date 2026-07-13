import type { PluginArchiveDB } from '@delta-comic/db'

import { pluginI18n } from '@/i18n'

export interface PluginDependencyMissing {
  pluginName: string
  dependencyName: string
}

export interface PluginLoadPlan {
  levels: PluginArchiveDB.Archive[][]
  missing: PluginDependencyMissing[]
  cycles: string[][]
}

const getDependencyNames = (plugin: PluginArchiveDB.Archive) =>
  plugin.meta.require.map(dep => dep.id)

const canonicalCycleKey = (cycle: string[]) => {
  const nodes = cycle.slice(0, -1)
  const rotations = nodes.map((_, index) => nodes.slice(index).concat(nodes.slice(0, index)))
  rotations.sort((a, b) => a.join('\0').localeCompare(b.join('\0')))
  return rotations[0].join('\0')
}

export const findCyclePaths = (plugins: PluginArchiveDB.Archive[]): string[][] => {
  const pluginNames = new Set(plugins.map(plugin => plugin.pluginName))
  const dependencies = new Map(
    plugins.map(plugin => [
      plugin.pluginName,
      getDependencyNames(plugin).filter(dep => pluginNames.has(dep)),
    ]),
  )

  const state = new Map<string, 'visiting' | 'visited'>()
  const path: string[] = []
  const cycleKeys = new Set<string>()
  const cycles: string[][] = []

  const visit = (pluginName: string) => {
    state.set(pluginName, 'visiting')
    path.push(pluginName)

    for (const dependencyName of dependencies.get(pluginName) ?? []) {
      const dependencyState = state.get(dependencyName)
      if (dependencyState === 'visiting') {
        const cycleStart = path.lastIndexOf(dependencyName)
        if (cycleStart === -1) continue

        const cycle = path.slice(cycleStart).concat(dependencyName)
        const key = canonicalCycleKey(cycle)
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key)
          cycles.push(cycle)
        }
        continue
      }

      if (dependencyState !== 'visited') visit(dependencyName)
    }

    path.pop()
    state.set(pluginName, 'visited')
  }

  for (const plugin of plugins) {
    if (!state.has(plugin.pluginName)) visit(plugin.pluginName)
  }

  return cycles
}

export const planPluginLoadOrder = (plugins: PluginArchiveDB.Archive[]): PluginLoadPlan => {
  const nameToPlugin = new Map(plugins.map(plugin => [plugin.pluginName, plugin]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  const missing: PluginDependencyMissing[] = []

  for (const plugin of plugins) {
    const dependencies = getDependencyNames(plugin)
    const installedDependencies = dependencies.filter(dependencyName => {
      const isInstalled = nameToPlugin.has(dependencyName)
      if (!isInstalled) missing.push({ pluginName: plugin.pluginName, dependencyName })
      return isInstalled
    })

    inDegree.set(plugin.pluginName, installedDependencies.length)
    for (const dependencyName of installedDependencies) {
      const dependents = adjacency.get(dependencyName) ?? []
      dependents.push(plugin.pluginName)
      adjacency.set(dependencyName, dependents)
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([pluginName]) => pluginName)

  const levels: PluginArchiveDB.Archive[][] = []
  while (queue.length > 0) {
    const levelSize = queue.length
    const level: PluginArchiveDB.Archive[] = []

    for (let index = 0; index < levelSize; index++) {
      const pluginName = queue.shift()
      if (!pluginName) continue

      const plugin = nameToPlugin.get(pluginName)
      if (plugin) level.push(plugin)

      for (const dependentName of adjacency.get(pluginName) ?? []) {
        const newDegree = (inDegree.get(dependentName) ?? 0) - 1
        inDegree.set(dependentName, newDegree)
        if (newDegree === 0) queue.push(dependentName)
      }
    }

    if (level.length > 0) levels.push(level)
  }

  const unresolved = plugins.filter(plugin => (inDegree.get(plugin.pluginName) ?? 0) > 0)
  const cycles = findCyclePaths(unresolved)

  return { levels, missing, cycles }
}

type PluginMessageTranslator = (key: string, params: Record<string, number | string>) => string

export const formatPluginLoadPlanError = (
  plan: Pick<PluginLoadPlan, 'missing' | 'cycles'>,
  translate: PluginMessageTranslator = (key, params) => pluginI18n.translate(key, params),
) => {
  const sections: string[] = []

  if (plan.missing.length > 0) {
    const missing = plan.missing
      .map(({ pluginName, dependencyName }) => `${pluginName} -> ${dependencyName}`)
      .join('\n')
    sections.push(translate('plugin.runtime.errors.missingDependencies', { missing }))
  }

  if (plan.cycles.length > 0) {
    const paths = plan.cycles.map(path => path.join(' -> ')).join('\n')
    sections.push(translate('plugin.runtime.errors.dependencyCycles', { paths }))
  }

  return sections.join('\n\n')
}