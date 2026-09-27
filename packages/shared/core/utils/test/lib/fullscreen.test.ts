import { describe, expect, it } from 'vite-plus/test'

import './setup'

describe('useFullscreen', () => {
  it('tracks manual fullscreen state updates', async () => {
    const { useFullscreen } = await import('../../lib/fullscreen')

    const fullscreen = useFullscreen()

    expect(fullscreen.isFullscreen.value).toBe(false)

    fullscreen.entry()
    expect(fullscreen.isFullscreen.value).toBe(true)

    fullscreen.toggle()
    expect(fullscreen.isFullscreen.value).toBe(false)

    fullscreen.exit()
    expect(fullscreen.isFullscreen.value).toBe(false)
  })

  it('syncs with document fullscreenchange events', async () => {
    const { useFullscreen } = await import('../../lib/fullscreen')
    const fullscreen = useFullscreen()
    const doc = document as unknown as {
      fullscreenElement: unknown
      dispatchEvent(event: Event): boolean
    }

    doc.fullscreenElement = {}
    doc.dispatchEvent(new Event('fullscreenchange'))

    expect(fullscreen.isFullscreen.value).toBe(true)

    doc.fullscreenElement = null
    doc.dispatchEvent(new Event('fullscreenchange'))

    expect(fullscreen.isFullscreen.value).toBe(false)
  })
})