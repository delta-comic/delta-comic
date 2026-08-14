import { pluginI18n } from '@delta-comic/plugin'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
})

vi.mock('@delta-comic/utils', () => ({
  PageWebviewAuth: class {},
  SharedFunction: { call: vi.fn() },
}))

import { formatDate, translateText } from '../../../src/i18n'

const fixtureMessages = {
  'zh-CN': { 'i18n-fixture': { greeting: '你好', nested: { label: '插件标签' } } },
}

describe('translateText', () => {
  beforeEach(() => pluginI18n.register('i18n-fixture', fixtureMessages))
  afterEach(() => pluginI18n.remove('i18n-fixture'))

  it('translates registered plugin keys', () => {
    expect(translateText('i18n-fixture.greeting')).toBe('你好')
    expect(translateText('i18n-fixture.nested.label')).toBe('插件标签')
  })

  it('resolves host locale keys', () => {
    expect(translateText('common.actions.reload')).toBe('重新加载')
  })

  it('passes through plain literal text', () => {
    expect(translateText('原样展示')).toBe('原样展示')
  })

  it('returns an empty string for empty values', () => {
    expect(translateText('')).toBe('')
    expect(translateText(null)).toBe('')
    expect(translateText(undefined)).toBe('')
  })
})

describe('formatDate', () => {
  it('formats localized date presets under the active locale', () => {
    expect(formatDate(new Date(2026, 7, 14), 'date')).toBe('2026年8月14日')
    expect(formatDate(new Date(2026, 7, 14, 9, 5), 'dateTime')).toBe('2026年8月14日 09:05')
    expect(formatDate(new Date(2026, 7, 14), 'monthDay')).toBe('8月14日')
    expect(formatDate(new Date(2026, 7, 14, 9, 5), 'time')).toBe('09:05')
  })

  it('returns an empty string for invalid values', () => {
    expect(formatDate('not-a-date', 'date')).toBe('')
  })
})