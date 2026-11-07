const attentionMessageKeys = {
  notificationPermissionDenied: 'download.attention.notificationPermissionDenied',
} as const

export type LocalizedDownloadAttentionCode = keyof typeof attentionMessageKeys
export type DownloadAttentionMessageKey =
  (typeof attentionMessageKeys)[LocalizedDownloadAttentionCode]

export function downloadAttentionMessageKey(code: string) {
  return attentionMessageKeys[code as LocalizedDownloadAttentionCode]
}

export function createDownloadAttentionReporter(
  report: (messageKey: DownloadAttentionMessageKey) => void,
) {
  const reportedCodes = new Set<string>()
  return (code: string) => {
    if (reportedCodes.has(code)) return false
    const messageKey = downloadAttentionMessageKey(code)
    if (!messageKey) return false
    reportedCodes.add(code)
    report(messageKey)
    return true
  }
}