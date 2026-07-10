import { describe, expect, it } from 'vitest'

import { joinUrl, normalizeApiBaseUrl } from './url'

describe('server admin URL normalization', () => {
  it('normalizes an origin and removes an accidental API suffix', () => {
    expect(normalizeApiBaseUrl(' https://example.workers.dev/api/ ')).toBe(
      'https://example.workers.dev',
    )
    expect(joinUrl('https://example.workers.dev/', 'api/admin/overview')).toBe(
      'https://example.workers.dev/api/admin/overview',
    )
  })

  it('rejects credentials, fragments, and unsupported protocols', () => {
    expect(() => normalizeApiBaseUrl('ftp://example.com')).toThrow(/http/)
    expect(() => normalizeApiBaseUrl('https://user:pass@example.com')).toThrow(/用户名/)
    expect(() => normalizeApiBaseUrl('https://example.com/#debug')).toThrow(/查询参数/)
  })
})