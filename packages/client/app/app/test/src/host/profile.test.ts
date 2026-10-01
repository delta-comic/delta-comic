import { describe, expect, it } from 'vite-plus/test'

import { createAppHostProfile, detectWebHostPlatform } from '../../../src/host/profile'

describe('app host profile', () => {
  it('describes desktop Tauri capabilities', () => {
    expect(createAppHostProfile({ platform: 'desktop', runtime: 'tauri' })).toEqual({
      platform: 'desktop',
      runtime: 'tauri',
      storage: 'native',
      downloads: 'native',
      supportsMultipleWindows: true,
      supportsBackgroundDownloads: true,
    })
  })

  it('keeps Android single-window storage and download boundaries explicit', () => {
    expect(createAppHostProfile({ platform: 'android', runtime: 'tauri' })).toMatchObject({
      platform: 'android',
      supportsMultipleWindows: false,
      storage: 'native',
      downloads: 'native',
    })
  })

  it('detects Android only from the supplied browser user agent', () => {
    expect(detectWebHostPlatform('Mozilla/5.0 Android 14')).toBe('android')
    expect(detectWebHostPlatform('Mozilla/5.0 X11; Linux x86_64')).toBe('desktop')
  })
})