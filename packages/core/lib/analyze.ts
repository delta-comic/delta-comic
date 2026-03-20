import * as Sentry from '@sentry/vue'
import { defaultOptions } from 'tauri-plugin-sentry-api'
import type { App } from 'vue'

export const initSentry = (app: App) => {
  Sentry.init({ ...defaultOptions, app, sendDefaultPii: true })
}