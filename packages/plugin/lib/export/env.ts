export type Platform = 'tauri' | 'web'
export interface ConfigEnv {
  safe: boolean
  platform: Platform
}