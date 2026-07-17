import createPreset, {
  type CommitType,
  type PresetConfig,
} from 'conventional-changelog-conventionalcommits'

export const prereleaseWarning =
  '**谨慎更新：当前版本为预发布版本，可能包含未完成的功能或兼容性问题，请在更新前备份数据。**'

export const releaseNoteTypes = [
  { type: 'feat', section: '新功能', effect: 'bump' },
  { type: 'feature', section: '新功能', effect: 'bump' },
  { type: 'fix', section: '问题修复', effect: 'bump' },
  { type: 'perf', section: '性能优化', effect: 'bump' },
  { type: 'refactor', section: '代码重构', effect: 'changelog' },
  { type: 'docs', section: '文档更新', effect: 'changelog' },
  { type: 'build', section: '构建系统', effect: 'changelog' },
  { type: 'ci', section: '持续集成', effect: 'changelog' },
  { type: 'test', section: '测试', effect: 'changelog' },
  { type: 'style', section: '代码样式', effect: 'changelog' },
  { type: 'revert', section: '变更回退', effect: 'bump' },
  { type: 'chore', section: '其他变更', effect: 'changelog' },
] as const satisfies readonly CommitType[]

export const releaseNotePresetConfig = {
  types: releaseNoteTypes as unknown as CommitType[],
} satisfies PresetConfig

interface ReleaseNote {
  title?: string
  [key: string]: unknown
}

interface TransformedCommit {
  notes?: ReleaseNote[]
  [key: string]: unknown
}

interface WriterOptions {
  transform: (
    commit: Record<string, unknown>,
    context: Record<string, unknown>,
  ) => TransformedCommit | undefined
}

const preset = createPreset(releaseNotePresetConfig) as { writer: WriterOptions }
const transformCommit = preset.writer.transform

export const releaseNoteWriterOptions = {
  transform(commit: Record<string, unknown>, context: Record<string, unknown>) {
    const transformed = transformCommit(commit, context)
    if (!transformed?.notes) return transformed

    return {
      ...transformed,
      notes: transformed.notes.map(note => ({ ...note, title: '破坏性变更' })),
    }
  },
}

export function createReleaseNameTemplate() {
  return 'Delta Comic <%= nextRelease.version %><%= nextRelease.channel ? " 预览版" : " 正式版" %>'
}