import { beforeEach, describe, expect, it, vi } from 'vitest'

import { D1ServerPluginHost } from '../../../../app/modules/plugins/plugins.host'
import { D1Recorder } from '../../d1'

describe('D1ServerPluginHost', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
  })

  it('reports probe success only for the expected scalar result', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push({ value: 1 }, { value: 0 }, null)
    const host = new D1ServerPluginHost(recorder.db)

    await expect(host.probeDatabase()).resolves.toBe(true)
    await expect(host.probeDatabase()).resolves.toBe(false)
    await expect(host.probeDatabase()).resolves.toBe(false)
    expect(recorder.statements[0]?.sql).toBe('SELECT 1 AS value')
  })

  it('binds current time only for active-session metrics and normalizes missing counts', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push({ value: 3 }, { value: 4 }, null)
    const host = new D1ServerPluginHost(recorder.db)

    await expect(host.readMetric('auth.activeSessions')).resolves.toBe(3)
    await expect(host.readMetric('sync.changeCount')).resolves.toBe(4)
    await expect(host.readMetric('sync.cursorBacklog')).resolves.toBe(0)

    expect(recorder.statements[0]?.values).toEqual([1_700_000_000_000])
    expect(recorder.statements[1]?.values).toEqual([])
    expect(recorder.statements[2]?.sql).toContain('latest.latest_seq - cursor.last_pulled_seq')
  })
})