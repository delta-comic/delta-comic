import { mockIPC } from '@tauri-apps/api/mocks'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import './test/setup'

afterEach(() => vi.unstubAllGlobals())

describe('db entry', () => {
  it('loads the application sqlite database through the Tauri SQL plugin', async () => {
    vi.stubGlobal('isTauri', true)
    const calls: Array<{ command: string; payload: unknown }> = []

    mockIPC((command, payload) => {
      calls.push({ command, payload })
      if (command === 'plugin:sql|load') return (payload as { db: string }).db
      throw new Error(`unexpected IPC command: ${command}`)
    })

    const { db } = await import('./index')

    expect(db).toBeDefined()
    expect(calls).toEqual([{ command: 'plugin:sql|load', payload: { db: 'sqlite:app.db' } }])
  })
})