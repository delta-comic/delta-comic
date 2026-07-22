import { Logger } from '@delta-comic/logger'
import { describe, expect, it, vi } from 'vitest'

import { D1Recorder } from '../../test/d1'

import { D1AdminMetricsRepository } from './admin.repository'

const tableNames = [
  'auth_users',
  'auth_terminals',
  'auth_sessions',
  'sync_entities',
  'sync_changes',
  'server_plugin_registry',
  'server_plugin_installations',
  'server_plugin_jobs',
  'server_plugin_audit',
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
    expect(metrics.find(metric => metric.key === 'pluginAudit')).toMatchObject({ value: 0 })
    expect(
      recorder.statements.find(statement => statement.sql.includes('refresh_expires_at >'))?.values,
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

  it('converts recent audit rows, parses valid detail, and clamps the requested limit', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push(
      [{ name: 'server_plugin_audit' }],
      [
        {
          action: 'enable',
          actor_id: 'admin',
          created_at: 20,
          detail_json: '{"changed":true}',
          id: 'audit-1',
          job_id: 'job-1',
          outcome: 'succeeded',
          plugin_id: 'core.base',
        },
        {
          action: 'health',
          actor_id: null,
          created_at: 10,
          detail_json: '{broken',
          id: 'audit-2',
          job_id: null,
          outcome: 'failed',
          plugin_id: 'feature.sync',
        },
      ],
    )
    const repository = new D1AdminMetricsRepository(recorder.db)

    const activity = await repository.readRecentPluginAudit(1_000)

    expect(activity).toEqual({
      available: true,
      items: [
        {
          action: 'enable',
          actorId: 'admin',
          createdAt: 20,
          detail: { changed: true },
          id: 'audit-1',
          jobId: 'job-1',
          outcome: 'succeeded',
          pluginId: 'core.base',
        },
        {
          action: 'health',
          createdAt: 10,
          id: 'audit-2',
          outcome: 'failed',
          pluginId: 'feature.sync',
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
    const activity = await repository.readRecentPluginAudit(5)

    expect(metrics.every(metric => metric.issue === 'query_failed')).toBe(true)
    expect(activity).toEqual({ available: false, issue: 'query_failed', items: [] })
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('reports a missing audit table without attempting the audit query', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([])
    const repository = new D1AdminMetricsRepository(recorder.db)

    await expect(repository.readRecentPluginAudit(5)).resolves.toEqual({
      available: false,
      issue: 'table_missing',
      items: [],
    })
    expect(recorder.statements).toHaveLength(1)
  })
})