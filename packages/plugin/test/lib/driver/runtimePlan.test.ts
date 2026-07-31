import type { PluginArchiveDB } from '@delta-comic/db'
import { describe, expect, it } from 'vite-plus/test'

import {
  failedDependencies,
  filterPluginsBySelection,
  pluginKind,
  selectPluginsForPhase,
} from '../../../lib/driver/runtimePlan'

const archive = (
  pluginName: string,
  kind?: 'normal' | 'preboot',
  dependencies: string[] = [],
): PluginArchiveDB.Archive => ({
  displayName: pluginName,
  enable: true,
  installerName: 'test',
  installInput: '',
  loaderName: 'test',
  meta: {
    author: 'test',
    description: pluginName,
    ...(kind ? { kind } : {}),
    name: { display: pluginName, id: pluginName },
    require: dependencies.map(id => ({ id })),
    version: { plugin: '1.0.0', supportCore: '*' },
  },
  pluginName,
})

describe('client plugin runtime plan', () => {
  it('treats legacy manifests as normal plugins', () => {
    expect(pluginKind(archive('legacy'))).toBe('normal')
  })

  it('loads only preboot plugins in the pre-mount phase', () => {
    const plugins = [archive('normal'), archive('early', 'preboot')]
    expect(selectPluginsForPhase(plugins, 'preboot').map(plugin => plugin.pluginName)).toEqual([
      'early',
    ])
  })

  it('considers an active preboot dependency satisfied for the normal phase', () => {
    const plugins = [archive('early', 'preboot'), archive('normal', 'normal', ['early'])]
    const [normal] = selectPluginsForPhase(plugins, 'normal')
    expect(normal.meta.require).toEqual([])
  })

  it('does not satisfy normal dependencies from merely enabled preboot metadata', () => {
    const plugins = [archive('early', 'preboot'), archive('normal', 'normal', ['early'])]
    const [normal] = selectPluginsForPhase(plugins, 'normal', new Set(['early']), new Set())
    expect(normal.meta.require).toEqual([{ id: 'early' }])
  })

  it('freezes plugin kinds for the current application session', () => {
    const changedToNormal = archive('early', 'normal')
    const changedToPreboot = archive('normal', 'preboot')
    const startupPreboot = new Set(['early'])

    expect(
      selectPluginsForPhase([changedToNormal, changedToPreboot], 'normal', startupPreboot).map(
        plugin => plugin.pluginName,
      ),
    ).toEqual(['normal'])
  })

  it('reports dependencies that failed in an earlier load level', () => {
    expect(failedDependencies(archive('child', 'normal', ['parent']), new Set(['parent']))).toEqual(
      ['parent'],
    )
  })

  it('restores only the remembered normal plugin selection', () => {
    const plugins = [archive('first'), archive('second'), archive('early', 'preboot')]
    expect(
      filterPluginsBySelection(plugins, new Set(['second'])).map(plugin => plugin.pluginName),
    ).toEqual(['second'])
  })
})