import { describe, expect, it } from 'vite-plus/test'

import formIndexSource from '../../../lib/components/form/index.ts?raw'
import rootIndexSource from '../../../lib/index.ts?raw'

import { componentEntries, showcaseEntries } from './catalog'
import { demoModulePaths } from './demoModules'

const collectNamedComponents = (source: string) => {
  return [...source.matchAll(/export\s*\{([\s\S]*?)\}/g)]
    .flatMap(match => match[1].match(/\bDc[A-Z]\w*/g) ?? [])
    .sort()
}

describe('UI showcase catalog', () => {
  it('creates exactly one catalog entry for every public Dc component', () => {
    const publicComponentNames = [
      ...collectNamedComponents(rootIndexSource),
      ...collectNamedComponents(formIndexSource),
    ].sort()
    const catalogComponentNames = componentEntries.map(entry => entry.name).sort()

    expect(catalogComponentNames).toHaveLength(28)
    expect(catalogComponentNames).toEqual(publicComponentNames)
  })

  it('keeps slugs, paths, and section anchors unique', () => {
    expect(new Set(showcaseEntries.map(entry => entry.slug)).size).toBe(showcaseEntries.length)
    expect(new Set(showcaseEntries.map(entry => entry.path)).size).toBe(showcaseEntries.length)

    for (const entry of showcaseEntries) {
      expect(entry.sections.length).toBeGreaterThanOrEqual(2)
      expect(new Set(entry.sections.map(section => section.id)).size).toBe(entry.sections.length)
    }
  })

  it('provides a lazy demo module for every component entry', () => {
    const availableNames = demoModulePaths.map(path =>
      path.replace('./demos/', '').replace('Demo.vue', ''),
    )

    expect(availableNames.sort()).toEqual(componentEntries.map(entry => entry.name).sort())
  })
})