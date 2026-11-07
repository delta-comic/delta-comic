export type AppHostPlatform = 'desktop' | 'android' | 'ios'
export type AppHostRuntime = 'tauri' | 'web'

export interface AppHostProfile {
  readonly platform: AppHostPlatform
  readonly runtime: AppHostRuntime
  readonly storage: 'native' | 'browser'
  readonly downloads: 'native' | 'browser'
  readonly supportsMultipleWindows: boolean
  readonly supportsBackgroundDownloads: boolean
}

export interface AppHostProfileInput {
  readonly platform?: AppHostPlatform
  readonly runtime?: AppHostRuntime
  readonly supportsMultipleWindows?: boolean
}

export const createAppHostProfile = (input: AppHostProfileInput = {}): AppHostProfile => {
  const runtime = input.runtime ?? 'web'
  const platform = input.platform ?? 'desktop'
  const native = runtime === 'tauri'
  const mobile = platform === 'android' || platform === 'ios'

  return {
    platform,
    runtime,
    storage: native ? 'native' : 'browser',
    downloads: native ? 'native' : 'browser',
    supportsMultipleWindows: input.supportsMultipleWindows ?? (native && !mobile),
    supportsBackgroundDownloads: native,
  }
}

export const detectWebHostPlatform = (
  userAgent = globalThis.navigator?.userAgent ?? '',
): AppHostPlatform =>
  /android/i.test(userAgent) ? 'android' : /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : 'desktop'