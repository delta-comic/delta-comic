import type { ContentSourceRefreshChange } from './contentSourceRefresh'

export type SourceRefreshWarningStatus =
  | 'context-missing'
  | 'asset-context-missing'
  | 'refresh-context-identity-mismatch'
  | 'plugin-not-loaded'
  | 'content-page-missing'
  | 'download-provider-missing'
  | 'source-refresh-unsupported'
  | 'content-page-construction-failed'
  | 'content-page-identity-mismatch'
  | 'plugin-metadata-missing'
  | 'plugin-metadata-unavailable'
  | 'content-page-fingerprint-unavailable'
  | 'provider-fingerprint-unavailable'
  | 'confirmation-required'
  | 'refresh-failed'

export interface SourceRefreshWarning {
  taskId: string
  taskTitle: string
  collectionTitle?: string
  status: SourceRefreshWarningStatus
  changes?: ContentSourceRefreshChange[]
}

export const sourceRefreshReasonForAttention = (code: string) => {
  if (code === 'sourceExpired') return 'expired' as const
  if (code === 'unauthorized') return 'unauthorized' as const
  if (code === 'forbidden') return 'forbidden' as const
  return 'expired' as const
}

export const sourceRefreshChangeToken = (changes: readonly ContentSourceRefreshChange[]) =>
  JSON.stringify(changes)