import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
})

vi.mock('@delta-comic/utils', () => ({
  PageWebviewAuth: class {},
  SharedFunction: { call: vi.fn() },
}))

import { createDateString } from '../../../src/utils/date'

describe('createDateString', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0))
  })

  afterEach(() => vi.useRealTimers())

  it('labels today and yesterday dates', () => {
    expect(createDateString(dayjs(new Date(2026, 2, 1, 8, 30)))).toBe('今天 08:30')
    expect(createDateString(dayjs(new Date(2026, 1, 28, 8, 30)))).toBe('昨天 08:30')
  })

  it('renders a compact month-day date within the current year', () => {
    expect(createDateString(dayjs(new Date(2026, 6, 1, 10, 5)))).toBe('7月1日 10:05')
  })

  it('renders a full localized date outside the current year', () => {
    expect(createDateString(dayjs(new Date(2025, 0, 5, 10, 0)))).toBe('2025年1月5日 10:00')
  })
})