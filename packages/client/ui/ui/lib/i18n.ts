export type UiMessageKey =
  | 'actions.retry'
  | 'actions.submit'
  | 'feedback.failed'
  | 'feedback.success'
  | 'form.pairs.keyPlaceholder'
  | 'form.pairs.valuePlaceholder'
  | 'image.retry'
  | 'status.loading'
  | 'status.networkError'
  | 'status.noResults'
  | 'status.unknownReason'

export type UiMessageParams = Record<string, number | string>
export type UiMessageResolver = (key: UiMessageKey, params?: UiMessageParams) => string

const fallbackMessages: Record<UiMessageKey, string> = {
  'actions.retry': 'Retry',
  'actions.submit': 'Submit',
  'feedback.failed': 'Failed!',
  'feedback.success': 'Success!',
  'form.pairs.keyPlaceholder': 'Plugin ID',
  'form.pairs.valuePlaceholder': 'Download command',
  'image.retry': 'Click to retry',
  'status.loading': 'Loading',
  'status.networkError': 'Network error',
  'status.noResults': 'No results',
  'status.unknownReason': 'Unknown reason',
}

let resolver: UiMessageResolver | undefined

export const configureUiI18n = (nextResolver?: UiMessageResolver) => {
  resolver = nextResolver
}

export const translateUi = (key: UiMessageKey, params?: UiMessageParams) =>
  resolver?.(key, params) || fallbackMessages[key]