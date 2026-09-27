import { satisfies as versionSatisfies } from 'semver'

import { AppError } from '@/shared/errors'

import type { ServerPluginLoadPlan, ServerPluginManifest } from '../../../lib/plugin'

const canonicalCycleKey = (cycle: string[]): string => {
  const nodes = cycle.slice(0, -1)
  const rotations = nodes.map((_, index) => nodes.slice(index).concat(nodes.slice(0, index)))
  rotations.sort((left, right) => left.join('\0').localeCompare(right.join('\0')))
  return rotations[0]?.join('\0') ?? ''
}

export const findServerPluginCycles = (manifests: readonly ServerPluginManifest[]): string[][] => {
  const installedIds = new Set(manifests.map(manifest => manifest.id))
  const dependencies = new Map(
    manifests.map(manifest => [
      manifest.id,
      manifest.dependencies.map(dependency => dependency.id).filter(id => installedIds.has(id)),
    ]),
  )
  const states = new Map<string, 'visited' | 'visiting'>()
  const path: string[] = []
  const cycleKeys = new Set<string>()
  const cycles: string[][] = []

  const visit = (pluginId: string): void => {
    states.set(pluginId, 'visiting')
    path.push(pluginId)
    for (const dependencyId of dependencies.get(pluginId) ?? []) {
      const state = states.get(dependencyId)
      if (state === 'visiting') {
        const cycleStart = path.lastIndexOf(dependencyId)
        if (cycleStart < 0) continue
        const cycle = path.slice(cycleStart).concat(dependencyId)
        const key = canonicalCycleKey(cycle)
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key)
          cycles.push(cycle)
        }
        continue
      }
      if (state !== 'visited') visit(dependencyId)
    }
    path.pop()
    states.set(pluginId, 'visited')
  }

  for (const manifest of manifests) {
    if (!states.has(manifest.id)) visit(manifest.id)
  }
  return cycles
}

export const planServerPluginLoadOrder = (
  manifests: readonly ServerPluginManifest[],
): ServerPluginLoadPlan => {
  const byId = new Map<string, ServerPluginManifest>()
  for (const manifest of manifests) {
    if (byId.has(manifest.id)) {
      throw new AppError(
        'PLUGIN_DUPLICATE_DEFINITION',
        `duplicate server plugin definition: ${manifest.id}`,
        500,
      )
    }
    byId.set(manifest.id, manifest)
  }

  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  const missing: ServerPluginLoadPlan['missing'] = []

  for (const manifest of manifests) {
    const installedDependencies = manifest.dependencies.filter(dependency => {
      const installed = byId.get(dependency.id)
      if (!installed) {
        missing.push({
          dependencyId: dependency.id,
          pluginId: manifest.id,
          reason: 'missing',
          ...(dependency.versionRange ? { versionRange: dependency.versionRange } : {}),
        })
        return false
      }
      if (
        dependency.versionRange &&
        !versionSatisfies(installed.version, dependency.versionRange)
      ) {
        missing.push({
          actualVersion: installed.version,
          dependencyId: dependency.id,
          pluginId: manifest.id,
          reason: 'incompatible',
          versionRange: dependency.versionRange,
        })
        return false
      }
      return true
    })
    inDegree.set(manifest.id, installedDependencies.length)
    for (const dependency of installedDependencies) {
      const current = dependents.get(dependency.id) ?? []
      current.push(manifest.id)
      dependents.set(dependency.id, current)
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([pluginId]) => pluginId)
    .sort()
  const levels: string[][] = []
  while (queue.length > 0) {
    const level = queue.splice(0, queue.length).sort()
    levels.push(level)
    for (const pluginId of level) {
      for (const dependentId of dependents.get(pluginId) ?? []) {
        const degree = (inDegree.get(dependentId) ?? 0) - 1
        inDegree.set(dependentId, degree)
        if (degree === 0) queue.push(dependentId)
      }
    }
  }

  const unresolved = manifests.filter(manifest => (inDegree.get(manifest.id) ?? 0) > 0)
  return { cycles: findServerPluginCycles(unresolved), levels, missing }
}

export const findServerPluginDependents = (
  pluginId: string,
  manifests: readonly ServerPluginManifest[],
): string[] =>
  manifests
    .filter(manifest => manifest.dependencies.some(dependency => dependency.id === pluginId))
    .map(manifest => manifest.id)
    .sort()