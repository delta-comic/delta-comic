import { afterEach, describe, expect, it } from 'vite-plus/test'

import { configureUiI18n, translateUi } from './i18n'

afterEach(() => configureUiI18n())

describe('UI i18n adapter', () => {
  it('uses readable fallbacks without an app resolver', () => {
    expect(translateUi('status.loading')).toBe('Loading')
  })

  it('delegates messages and parameters to the app resolver', () => {
    configureUiI18n((key, params) => `${key}:${params?.count}`)

    expect(translateUi('status.noResults', { count: 2 })).toBe('status.noResults:2')
  })
})