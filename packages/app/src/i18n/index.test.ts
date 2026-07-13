import { describe, expect, it } from 'vite-plus/test'

import { resolveAppLocale, resolveSystemLocale } from './locale'

describe('resolveSystemLocale', () => {
  it.each(['zh-TW', 'zh-Hant', 'zh-Hant-TW', 'zh-HK', 'zh-MO', 'zh_Hant_HK'])(
    '将 %s 推断为繁体中文（台湾）',
    language => {
      expect(resolveSystemLocale(language)).toBe('zh-TW')
    },
  )

  it.each(['zh', 'zh-CN', 'zh-Hans', 'zh-SG'])('将其他中文地区 %s 推断为简体中文', language => {
    expect(resolveSystemLocale(language)).toBe('zh-CN')
  })

  it.each(['en-US', 'ja-JP', undefined])('将非中文地区 %s 推断为英文', language => {
    expect(resolveSystemLocale(language)).toBe('en-US')
  })
})

describe('resolveAppLocale', () => {
  it.each(['en-US', 'zh-CN', 'zh-TW'] as const)('保留显式配置的 %s', locale => {
    expect(resolveAppLocale(locale)).toBe(locale)
  })
})