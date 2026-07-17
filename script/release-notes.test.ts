import { describe, expect, it } from 'vitest'

import { createReleaseNameTemplate, releaseNoteWriterOptions } from './release-notes.mts'

function commit(type: string, notes: Record<string, unknown>[] = []) {
  return {
    body: null,
    footer: null,
    hash: '1234567890',
    notes,
    references: [],
    scope: 'release',
    subject: '更新发布流程',
    type,
  }
}

describe('Chinese release notes', () => {
  it.each([
    ['feat', '新功能'],
    ['fix', '问题修复'],
    ['docs', '文档更新'],
    ['ci', '持续集成'],
  ])('renders %s commits in the %s section', (type, section) => {
    expect(releaseNoteWriterOptions.transform(commit(type), {})).toMatchObject({ type: section })
  })

  it('translates the breaking-change heading', () => {
    expect(
      releaseNoteWriterOptions.transform(
        commit('feat', [{ text: '插件 API 不再兼容', title: 'BREAKING CHANGE' }]),
        {},
      ),
    ).toMatchObject({ notes: [{ title: '破坏性变更' }] })
  })

  it('uses a Chinese title for both stable and preview GitHub releases', () => {
    expect(createReleaseNameTemplate()).toContain('预览版')
    expect(createReleaseNameTemplate()).toContain('正式版')
  })
})