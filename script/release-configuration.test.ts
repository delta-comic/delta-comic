import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import releaseConfig, { releaseBranches } from '../release.config.ts'

import { releaseNoteTypes } from './release-notes.mts'
import { rootDir, versionAssetPaths } from './set-version.mts'

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

  it('reuses Linux-built libraries and keeps Android on a replayable CLI command', async () => {
    const workflow = await readFile(join(rootDir, '.github/workflows/release.yaml'), 'utf-8')

    expect(workflow.match(/run: vp run lib-build/g)).toHaveLength(2)
    expect(workflow).toContain('name: workspace-libraries')
    expect(workflow.match(/name: Download workspace libraries/g)).toHaveLength(2)
    expect(workflow).toContain('pnpm tauri android init --ci --skip-targets-install')
    expect(workflow).toContain('pnpm tauri android build --ci --target aarch64 armv7')
    expect(workflow).not.toContain('uses: tauri-apps/tauri-action@dev')
  })

  it('does not cache package scripts with external side effects', async () => {
    const viteConfig = await readFile(join(rootDir, 'vite.config.ts'), 'utf-8')
    expect(viteConfig).toContain('run: { cache: { tasks: true, scripts: false } }')
  })

  it('commits version changes for newly added workspace manifests', () => {
    expect(versionAssetPaths).toContain('packages/*/package.json')
  })

  it('uses Chinese release names and complete Chinese changelog sections', () => {
    expect(releaseNoteTypes.map(type => type.section)).toEqual([
      '新功能',
      '新功能',
      '问题修复',
      '性能优化',
      '代码重构',
      '文档更新',
      '构建系统',
      '持续集成',
      '测试',
      '代码样式',
      '变更回退',
      '其他变更',
    ])
    expect(JSON.stringify(releaseConfig.plugins)).toContain('releaseNameTemplate')
    expect(JSON.stringify(releaseConfig.plugins)).toContain('预览版')
    expect(JSON.stringify(releaseConfig.plugins)).toContain('正式版')
  })

  it('places the prerelease warning before generated changelog sections', () => {
    const pluginNames = releaseConfig.plugins.map(plugin =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    )
    expect(pluginNames.indexOf('./script/semantic-release-plugin.mts')).toBeLessThan(
      pluginNames.indexOf('@semantic-release/release-notes-generator'),
    )
    expect(pluginNames.indexOf('@semantic-release/release-notes-generator')).toBeLessThan(
      pluginNames.indexOf('@semantic-release/changelog'),
    )
  })
})