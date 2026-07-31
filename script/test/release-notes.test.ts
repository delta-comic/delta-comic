import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { createReleaseNameTemplate } from '../release-notes.mts'
import { rootDir } from '../set-version.mts'

interface GenerateNotes {
  (
    pluginConfig: { preset: string },
    context: {
      commits: { hash: string; message: string }[]
      cwd: string
      lastRelease: { gitHead: string; gitTag: string }
      nextRelease: { gitHead: string; gitTag: string; version: string }
      options: { repositoryUrl: string }
    },
  ): Promise<string>
}

async function loadGenerateNotes() {
  const require = createRequire(import.meta.url)
  const moduleUrl = pathToFileURL(require.resolve('@semantic-release/release-notes-generator'))
  const module = (await import(moduleUrl.href)) as { generateNotes: GenerateNotes }
  return module.generateNotes
}

describe('release notes', () => {
  it.each(['3.0.1', '3.0.1-next.1'])('renders commit details for %s', async version => {
    const generateNotes = await loadGenerateNotes()
    const notes = await generateNotes(
      { preset: 'angular' },
      {
        commits: [{ hash: '1234567890abcdef', message: 'fix(release): 恢复发布说明内容' }],
        cwd: rootDir,
        lastRelease: { gitHead: 'previous', gitTag: '3.0.0' },
        nextRelease: { gitHead: 'current', gitTag: version, version },
        options: { repositoryUrl: 'https://github.com/delta-comic/delta-comic.git' },
      },
    )

    expect(notes).toContain('### Bug Fixes')
    expect(notes).toContain('恢复发布说明内容')
    expect(notes).toContain('/commit/1234567890abcdef')
  })

  it('uses a Chinese title for both stable and preview GitHub releases', () => {
    expect(createReleaseNameTemplate()).toContain('预览版')
    expect(createReleaseNameTemplate()).toContain('正式版')
  })
})