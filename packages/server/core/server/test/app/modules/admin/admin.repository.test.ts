import { Logger } from '@delta-comic/logger'
import { describe, expect, it, vi } from 'vite-plus/test'

import { D1AdminMetricsRepository } from '../../../../app/modules/admin/admin.repository'
import { D1Recorder } from '../../d1'

const tableNames = [
  'auth_users',
  'auth_terminals',
  'auth_sessions',
  'sync_entities',
  'sync_changes',
  'server_plugin_packages',
  'server_plugin_schedules',
  'server_plugin_runs',
  'server_plugin_store',
]

describe('D1AdminMetricsRepository', () => {
  it('probes D1 and rejects unexpected readiness results', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push({ ok: 1 }, { ok: 0 })
    const repository = new D1AdminMetricsRepository(recorder.db)

    await expect(repository.probeDatabase()).resolves.toBeUndefined()
    await expect(repository.probeDatabase()).rejects.toThrow(
      'D1 readiness probe returned an unexpected result',
    )
  })

  it('reports real counts, clamps negative values, and binds observation time for sessions', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push(tableNames.map(name => ({ name })))
    recorder.firstResults.push(
      { value: 2 },
      { value: 3 },
      { value: 4 },
      { value: 5 },
      { value: 6 },
      { value: 7 },
      { value: 8 },
      { value: 9 },
      { value: -10 },
    )
    const repository = new D1AdminMetricsRepository(recorder.db)

    const metrics = await repository.readMetrics(123_456)

    expect(metrics).toHaveLength(9)
    expect(metrics.find(metric => metric.key === 'activeAuthSessions')).toMatchObject({
      source: { filter: 'revoked_at IS NULL AND refresh_expires_at > observedAt' },
      status: 'ok',
      value: 4,
    })
    expect(metrics.find(metric => metric.key === 'pluginStore')).toMatchObject({ value: 0 })
    expect(
      recorder.statements.find(statement => statement.values.includes(123_456))?.values,
    ).toEqual([123_456])
  })

  it('marks absent tables as degraded without querying them', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([{ name: 'auth_users' }])
    recorder.firstResults.push({ value: 12 })
    const repository = new D1AdminMetricsRepository(recorder.db)

    const metrics = await repository.readMetrics(1)

    expect(metrics[0]).toMatchObject({ key: 'authUsers', status: 'ok', value: 12 })
    expect(metrics.slice(1).every(metric => metric.issue === 'table_missing')).toBe(true)
    expect(recorder.statements).toHaveLength(2)
  })

  it('converts recent flow rows, parses valid detail, and clamps the requested limit', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push(
      [{ name: 'server_plugin_runs' }],
      [
        {
          id: 'run-1',
          tenant_id: 'alice',
          plugin_id: 'counter',
          flow_id: 'main',
          trigger: 'manual',
          status: 'succeeded',
          input_json: null,
          result_json: null,
          step_id: null,
          error_message: null,
          metrics_json: '{}',
          started_at: 20,
          completed_at: 21,
        },
      ],
    )
    const repository = new D1AdminMetricsRepository(recorder.db)

    const activity = await repository.readRecentPluginRuns(1_000)

    expect(activity).toEqual({
      available: true,
      items: [
        {
          id: 'run-1',
          pluginId: 'counter',
          action: 'main',
          actorId: 'alice',
          createdAt: 20,
          detail: { trigger: 'manual', stepId: null, error: null },
          outcome: 'succeeded',
        },
      ],
    })
    expect(recorder.statements.at(-1)?.values).toEqual([100])
  })

  it('returns structured degraded results when table inspection fails', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    const db = {
      prepare: () => ({
        bind: () => ({ all: async () => Promise.reject(new Error('D1 unavailable')) }),
      }),
    } as unknown as D1Database
    const repository = new D1AdminMetricsRepository(db)

    const metrics = await repository.readMetrics(1)
    const activity = await repository.readRecentPluginRuns(5)

    expect(metrics.every(metric => metric.issue === 'query_failed')).toBe(true)
    expect(activity).toEqual({ available: false, issue: 'query_failed', items: [] })
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('reports a missing audit table without attempting the audit query', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([])
    const repository = new D1AdminMetricsRepository(recorder.db)

    await expect(repository.readRecentPluginRuns(5)).resolves.toEqual({
      available: false,
      issue: 'table_missing',
      items: [],
    })
    expect(recorder.statements).toHaveLength(1)
  })
})