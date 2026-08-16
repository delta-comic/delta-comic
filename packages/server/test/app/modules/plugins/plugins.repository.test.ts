import { describe, expect, it } from 'vitest'

import { ServerPluginRepository } from '../../../../app/modules/plugins/plugins.repository'
import type {
  ServerPluginAuditRow,
  ServerPluginInstallationRow,
  ServerPluginJobRow,
  ServerPluginRegistryRow,
} from '../../../../app/modules/plugins/plugins.types'
import { D1Recorder } from '../../d1'

const registry: ServerPluginRegistryRow = {
  manifest_json: '{"id":"core.base"}',
  plugin_id: 'core.base',
  registered_at: 1,
  source: 'static',
  trusted: 1,
  updated_at: 2,
}

const installation: ServerPluginInstallationRow = {
  config_json: '{}',
  desired_state: 'enabled',
  installed_at: 3,
  installed_version: '1.0.0',
  last_error: null,
  last_health_at: 4,
  last_health_json: '{"status":"healthy"}',
  observed_state: 'enabled',
  plugin_id: registry.plugin_id,
  updated_at: 5,
}

const job: ServerPluginJobRow = {
  action: 'install',
  completed_at: 8,
  created_at: 6,
  error_message: null,
  id: 'job-1',
  plugin_id: registry.plugin_id,
  result_json: '{"changed":true}',
  started_at: 7,
  status: 'succeeded',
  updated_at: 8,
}

const audit: ServerPluginAuditRow = {
  action: 'install',
  actor_id: 'admin',
  created_at: 9,
  detail_json: '{"changed":true}',
  id: 'audit-1',
  job_id: job.id,
  outcome: 'succeeded',
  plugin_id: registry.plugin_id,
}

describe('ServerPluginRepository', () => {
  it('lists, finds, saves, and removes registry rows', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([registry])
    recorder.firstResults.push(registry)
    const repository = new ServerPluginRepository(recorder.db)

    await expect(repository.listRegistry()).resolves.toEqual([registry])
    await expect(repository.findRegistry(registry.plugin_id)).resolves.toEqual(registry)
    await repository.saveRegistry(registry)
    await repository.removeRegistry(registry.plugin_id)

    expect(recorder.statements[2]?.values).toEqual([
      registry.manifest_json,
      registry.plugin_id,
      registry.registered_at,
      registry.source,
      registry.trusted,
      registry.updated_at,
      registry.manifest_json,
      registry.source,
      registry.trusted,
      registry.updated_at,
    ])
    expect(recorder.statements[2]?.sql).toContain('on conflict ("plugin_id")')
    expect(recorder.statements[3]?.values).toEqual([registry.plugin_id])
  })

  it('lists, finds, saves, and removes installations with health state intact', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([installation])
    recorder.firstResults.push(installation)
    const repository = new ServerPluginRepository(recorder.db)

    await expect(repository.listInstallations()).resolves.toEqual([installation])
    await expect(repository.findInstallation(registry.plugin_id)).resolves.toEqual(installation)
    await repository.saveInstallation(installation)
    await repository.removeInstallation(registry.plugin_id)

    expect(recorder.statements[2]?.values).toEqual([
      installation.config_json,
      installation.desired_state,
      installation.installed_at,
      installation.installed_version,
      installation.last_error,
      installation.last_health_at,
      installation.last_health_json,
      installation.observed_state,
      installation.plugin_id,
      installation.updated_at,
      installation.config_json,
      installation.desired_state,
      installation.installed_version,
      installation.last_error,
      installation.last_health_at,
      installation.last_health_json,
      installation.observed_state,
      installation.updated_at,
    ])
    expect(recorder.statements[3]?.sql).toContain('delete from "server_plugin_installations"')
  })

  it('lists, finds, and saves operation jobs with an explicit limit', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([job])
    recorder.firstResults.push(job)
    const repository = new ServerPluginRepository(recorder.db)

    await expect(repository.listJobs(25)).resolves.toEqual([job])
    await expect(repository.findJob(job.id)).resolves.toEqual(job)
    await repository.saveJob(job)

    expect(recorder.statements[0]?.values).toEqual([25])
    expect(recorder.statements[2]?.values).toEqual([
      job.action,
      job.completed_at,
      job.created_at,
      job.error_message,
      job.id,
      job.plugin_id,
      job.result_json,
      job.started_at,
      job.status,
      job.updated_at,
      job.completed_at,
      job.error_message,
      job.result_json,
      job.started_at,
      job.status,
      job.updated_at,
    ])
  })

  it('lists and inserts immutable audit events', async () => {
    const recorder = new D1Recorder()
    recorder.allResults.push([audit])
    const repository = new ServerPluginRepository(recorder.db)

    await expect(repository.listAudit(10)).resolves.toEqual([audit])
    await repository.saveAudit(audit)

    expect(recorder.statements[0]?.values).toEqual([10])
    expect(recorder.statements[1]?.values).toEqual([
      audit.action,
      audit.actor_id,
      audit.created_at,
      audit.detail_json,
      audit.id,
      audit.job_id,
      audit.outcome,
      audit.plugin_id,
    ])
  })
})