import { describe, expect, it, vi } from 'vitest'

import {
  pluginI18n,
  pluginMessageKey,
  PluginI18nRegistry,
  translatePluginText,
} from '../../../lib/adapters/i18n'

describe('PluginI18nRegistry', () => {
  it('merges plugin messages per locale without mutating base or plugin inputs', () => {
    const adapter = { setLocaleMessage: vi.fn() }
    const registry = new PluginI18nRegistry()
    const base = { 'zh-CN': { app: { title: '宿主' } }, 'en-US': { app: { title: 'Host' } } }
    registry.install(adapter, base)

    const first = { 'zh-CN': { example: { a: '甲' } }, 'en-US': { example: { a: 'A' } } }
    registry.register('example', first)
    registry.register('other', { 'zh-CN': { example: { b: '乙' }, other: { x: '丙' } } })

    expect(adapter.setLocaleMessage).toHaveBeenCalledWith('zh-CN', {
      app: { title: '宿主' },
      example: { a: '甲', b: '乙' },
      other: { x: '丙' },
    })
    expect(adapter.setLocaleMessage).toHaveBeenCalledWith('en-US', {
      app: { title: 'Host' },
      example: { a: 'A' },
    })
    expect(first['zh-CN'].example).toEqual({ a: '甲' })
    expect(base['zh-CN']).toEqual({ app: { title: '宿主' } })
  })

  it('lets re-registration override previous keys without mutating the new messages', () => {
    const adapter = { setLocaleMessage: vi.fn() }
    const registry = new PluginI18nRegistry()
    registry.install(adapter, { 'zh-CN': { app: { title: '宿主' } } })

    registry.register('example', { 'zh-CN': { example: { a: '甲', b: '乙' } } })
    const updated = { 'zh-CN': { example: { a: '新甲' } } }
    registry.register('example', updated)

    expect(adapter.setLocaleMessage).toHaveBeenLastCalledWith('zh-CN', {
      app: { title: '宿主' },
      example: { a: '新甲', b: '乙' },
    })
    expect(updated['zh-CN'].example).toEqual({ a: '新甲' })
  })

  it('purges a removed plugin from every locale while keeping base and other plugins', () => {
    const adapter = { setLocaleMessage: vi.fn() }
    const registry = new PluginI18nRegistry()
    registry.install(adapter, {
      'zh-CN': { app: { title: '宿主' } },
      'en-US': { app: { title: 'Host' } },
    })

    registry.register('example', {
      'zh-CN': { example: { a: '甲' } },
      'en-US': { example: { a: 'A' } },
    })
    registry.register('other', { 'zh-CN': { other: { x: '丙' } } })
    registry.remove('example')

    expect(adapter.setLocaleMessage).toHaveBeenCalledWith('zh-CN', {
      app: { title: '宿主' },
      other: { x: '丙' },
    })
    expect(adapter.setLocaleMessage).toHaveBeenCalledWith('en-US', { app: { title: 'Host' } })
  })
})

describe('plugin text protocol', () => {
  it('translates `i18n:` prefixed keys through the adapter and passes through raw values', () => {
    const adapter = { setLocaleMessage: vi.fn(), translate: vi.fn((key: string) => `译:${key}`) }
    pluginI18n.install(adapter, {})

    expect(pluginMessageKey('example.a')).toBe('i18n:example.a')
    expect(translatePluginText(pluginMessageKey('example.a'))).toBe('译:example.a')
    expect(translatePluginText('普通文本')).toBe('普通文本')
    expect(adapter.translate).toHaveBeenCalledWith('example.a', undefined)
  })
})