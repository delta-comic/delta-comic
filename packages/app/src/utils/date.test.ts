import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const locale = vi.hoisted(() => ({ value: 'en-US' }))

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      locale,
      t: (key: string) => {
        if (key === 'date.today') return locale.value === 'zh-CN' ? '今天' : 'Today'
        if (key === 'date.yesterday') return locale.value === 'zh-CN' ? '昨天' : 'Yesterday'
        return key
      },
    },
  },
}))

import { createDateString } from './date'

describe('createDateString', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0))
  })

  afterEach(() => vi.useRealTimers())

  it('recognizes yesterday across month boundaries', () => {
    locale.value = 'en-US'

    expect(createDateString(dayjs(new Date(2026, 1, 28, 8, 30)))).toContain('Yesterday')
  })

  it('uses the active locale for relative dates', () => {
    locale.value = 'zh-CN'

    expect(createDateString(dayjs(new Date(2026, 2, 1, 8, 30)))).toContain('今天')
  })
})