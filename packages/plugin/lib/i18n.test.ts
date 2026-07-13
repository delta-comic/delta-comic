import { describe, expect, it, vi } from 'vite-plus/test'

import { PluginI18nRegistry, type PluginLocaleMessage } from './i18n'

describe('plugin i18n registry', () => {
  it('delegates runtime messages and interpolation parameters to the app adapter', () => {
    const translate = vi.fn(
      (key: string, params?: Record<string, number | string>) => `${key}:${params?.plugin}`,
    )
    const registry = new PluginI18nRegistry()
    registry.install({ setLocaleMessage: vi.fn(), translate }, {})

    expect(registry.translate('plugin.runtime.loading', { plugin: 'reader' })).toBe(
      'plugin.runtime.loading:reader',
    )
    expect(translate).toHaveBeenCalledWith('plugin.runtime.loading', { plugin: 'reader' })
  })

  it('layers plugin messages and restores overridden values on removal', () => {
    const locales = new Map<string, PluginLocaleMessage>()
    const setLocaleMessage = vi.fn((locale: string, message: PluginLocaleMessage) => {
      locales.set(locale, message)
    })
    const registry = new PluginI18nRegistry()
    registry.install(
      { setLocaleMessage },
      { 'zh-CN': { plugin: { action: '启动', state: '等待' } } },
    )
    registry.register('reader', {
      'zh-CN': { plugin: { action: '打开' } },
      'en-US': { plugin: { action: 'Open' } },
    })

    expect(locales.get('zh-CN')).toEqual({ plugin: { action: '打开', state: '等待' } })
    expect(locales.get('en-US')).toEqual({ plugin: { action: 'Open' } })

    registry.remove('reader')
    expect(locales.get('zh-CN')).toEqual({ plugin: { action: '启动', state: '等待' } })
    expect(locales.get('en-US')).toEqual({})
  })
})