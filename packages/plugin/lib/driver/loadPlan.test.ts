import type { PluginArchiveDB } from '@delta-comic/db'
import { describe, expect, it } from 'vite-plus/test'

import { findCyclePaths, formatPluginLoadPlanError, planPluginLoadOrder } from './loadPlan'

const translateLoadPlanError = (key: string, params: Record<string, number | string>) => {
  if (key === 'plugin.runtime.errors.missingDependencies') {
    return `插件依赖缺失:\n${params.missing}`
  }
  if (key === 'plugin.runtime.errors.dependencyCycles') {
    return `插件循环引用:\n${params.paths}`
  }
  return key
}

const archive = (pluginName: string, dependencies: string[] = []): PluginArchiveDB.Archive => ({
  pluginName,
  loaderName: 'test',
  installerName: 'test',
  enable: true,
  installInput: '',
  displayName: pluginName,
  meta: {
    name: { display: pluginName, id: pluginName },
    version: { plugin: '1.0.0', supportCore: '1.0.0' },
    author: '',
    description: '',
    require: dependencies.map(id => ({ id })),
  },
})

const levelNames = (levels: PluginArchiveDB.Archive[][]) =>
  levels.map(level => level.map(plugin => plugin.pluginName))

describe('planPluginLoadOrder', () => {
  it('groups plugins by dependency level and ignores core dependencies', () => {
    const plan = planPluginLoadOrder([
      archive('reader', ['source']),
      archive('source', []),
      archive('theme', ['source']),
      archive('offline', ['reader', 'theme']),
    ])

    expect(levelNames(plan.levels)).toEqual([['source'], ['reader', 'theme'], ['offline']])
    expect(plan.missing).toEqual([])
    expect(plan.cycles).toEqual([])
  })

  it('reports missing dependencies separately from cycles', () => {
    const plan = planPluginLoadOrder([archive('reader', ['missing-source'])])

    expect(levelNames(plan.levels)).toEqual([['reader']])
    expect(plan.missing).toEqual([{ pluginName: 'reader', dependencyName: 'missing-source' }])
    expect(plan.cycles).toEqual([])
    expect(formatPluginLoadPlanError(plan, translateLoadPlanError)).toBe(
      '插件依赖缺失:\nreader -> missing-source',
    )
  })

  it('detects dependency cycle paths', () => {
    const plugins = [archive('a', ['b']), archive('b', ['c']), archive('c', ['a'])]

    expect(findCyclePaths(plugins)).toEqual([['a', 'b', 'c', 'a']])

    const plan = planPluginLoadOrder(plugins)
    expect(plan.levels).toEqual([])
    expect(plan.cycles).toEqual([['a', 'b', 'c', 'a']])
    expect(formatPluginLoadPlanError(plan, translateLoadPlanError)).toBe(
      '插件循环引用:\na -> b -> c -> a',
    )
  })
})