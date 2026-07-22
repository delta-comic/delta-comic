import { describe, expect, it, vi } from 'vite-plus/test'

import { createDownloadAttentionReporter, downloadAttentionMessageKey } from './attention'

describe('downloadAttentionMessageKey', () => {
  it('maps Android notification denial to a localizable message', () => {
    expect(downloadAttentionMessageKey('notificationPermissionDenied')).toBe(
      'download.attention.notificationPermissionDenied',
    )
  })

  it('leaves unknown engine attention codes to their specialized handlers', () => {
    expect(downloadAttentionMessageKey('sourceExpired')).toBeUndefined()
    expect(downloadAttentionMessageKey('futureAttentionCode')).toBeUndefined()
  })

  it('reports a global permission warning only once per app lifecycle', () => {
    const report = vi.fn()
    const handle = createDownloadAttentionReporter(report)

    expect(handle('notificationPermissionDenied')).toBe(true)
    expect(handle('notificationPermissionDenied')).toBe(false)
    expect(handle('sourceExpired')).toBe(false)
    expect(report).toHaveBeenCalledExactlyOnceWith(
      'download.attention.notificationPermissionDenied',
    )
  })
})