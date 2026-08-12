import type { DownloadMessageBind } from '@delta-comic/ui'
import { describe, expect, it, vi } from 'vite-plus/test'

import { runPluginInstallPhases } from '../../../../src/features/pluginInstall/runPluginInstallPhases'

describe('runPluginInstallPhases', () => {
  it('reports install phases as mixed progress and loading entries', async () => {
    const entries = new Map<string, { description: string; progress?: number }>()
    const create = (progress: boolean) =>
      vi.fn(async (title: string, run: (state: any) => Promise<unknown>) => {
        const state = { description: '', retryable: false, ...(progress ? { progress: 0 } : {}) }
        entries.set(title, state)
        return await run(state)
      })
    const createProgress = create(true)
    const createLoading = create(false)
    const bind = { createLoading, createProgress } as DownloadMessageBind

    await expect(
      runPluginInstallPhases(
        bind,
        { decode: 'Decode', persist: 'Persist', resolve: 'Download' },
        progress => `${progress.phase}:${progress.progress}`,
        async ({ report }) => {
          report?.({ phase: 'resolve', progress: 40 })
          report?.({ phase: 'decode', progress: 50 })
          report?.({ phase: 'persist', progress: 75 })
          return 'installed'
        },
      ),
    ).resolves.toBe('installed')

    expect(createProgress.mock.calls.map(([title]) => title)).toEqual(['Download', 'Persist'])
    expect(createLoading.mock.calls.map(([title]) => title)).toEqual(['Decode'])
    expect(entries.get('Download')).toMatchObject({ description: 'resolve:40', progress: 40 })
    expect(entries.get('Decode')).toEqual({ description: 'decode:50', retryable: false })
    expect(entries.get('Persist')).toMatchObject({ description: 'persist:75', progress: 75 })
  })
})