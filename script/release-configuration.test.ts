import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import releaseConfig, { releaseBranches } from '../release.config.mjs'

import { rootDir } from './set-version.mts'

describe('release channel configuration', () => {
  it('maps main to stable releases and next to next prereleases', () => {
    expect(releaseBranches).toEqual(['main', { name: 'next', channel: 'next', prerelease: 'next' }])
    expect(releaseConfig.branches).toBe(releaseBranches)
    expect(JSON.stringify(releaseBranches)).not.toContain('develop')
  })

  it('runs release CI only for main and next without a commit-message gate', async () => {
    const workflow = await readFile(join(rootDir, '.github/workflows/release.yaml'), 'utf-8')
    expect(workflow).toMatch(/branches:\n\s+- 'main'\n\s+- 'next'/)
    expect(workflow).toContain("if: github.ref_name == 'main' || github.ref_name == 'next'")
    expect(workflow).toContain('vp run --no-cache release:dry-run')
    expect(workflow).toContain('vp run --no-cache release')
    expect(workflow).not.toContain('[pub]')
    expect(workflow).not.toMatch(/branches:\n(?:\s+- .*\n)*\s+- 'develop'/)
  })

  it('does not cache package scripts with external side effects', async () => {
    const viteConfig = await readFile(join(rootDir, 'vite.config.ts'), 'utf-8')
    expect(viteConfig).toContain('run: { cache: { tasks: true, scripts: false } }')
  })
})