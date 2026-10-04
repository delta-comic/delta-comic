import { describe, expect, it } from 'vite-plus/test'

import { router } from '../../src/router'

describe('admin router', () => {
  it('resolves feature and fallback routes and updates the document title', async () => {
    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('settings')
    expect(document.title).toBe('连接设置 · Delta Comic Server')

    await router.push('/missing-page')
    expect(router.currentRoute.value.name).toBe('not-found')
    expect(document.title).toBe('页面不存在 · Delta Comic Server')
  }, 15_000)

  it('restores scroll position to the page origin', () => {
    expect(router.options.scrollBehavior?.({} as any, {} as any, null)).toEqual({ left: 0, top: 0 })
  })
})