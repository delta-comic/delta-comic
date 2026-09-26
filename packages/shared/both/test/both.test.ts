import { describe, expect, it } from 'vitest'

import {
  Context,
  CordisRuntime,
  diagnostic,
  DiagnosticRecorder,
  Service,
  sha256Integrity,
  validateArtifact,
} from '../lib/index.js'

declare module 'cordis' {
  interface Context {
    dummy: DummyService
  }
}

class DummyService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'dummy')
  }

  ping() {
    return 'pong'
  }
}

class TracedService {
  public readonly diagnostics = new DiagnosticRecorder({ source: 'traced-service' })

  @diagnostic('demo/ping')
  ping(value: string) {
    return value.toUpperCase()
  }

  @diagnostic('demo/fail')
  fail(): never {
    throw new Error('expected failure')
  }
}

describe('@delta-comic/both cordis integration', () => {
  it('mounts service properly', async () => {
    const ctx = new Context()
    await ctx.plugin(DummyService)
    expect(ctx.dummy).toBeDefined()
    expect(ctx.dummy.ping()).toBe('pong')
  })

  it('records bounded diagnostics', () => {
    const recorder = new DiagnosticRecorder({
      source: 'test',
      capacity: 2,
      id: () => 'id',
      now: () => 1,
    })
    recorder.record('info', 'one')
    recorder.record('warn', 'two')
    recorder.record('error', 'three')
    expect(recorder.list().map(record => record.message)).toEqual(['two', 'three'])
    expect(recorder.snapshot().runtime).toBe('test')
  })

  it('traces decorated methods without mixing logging into business logic', () => {
    const service = new TracedService()
    expect(service.ping('ok')).toBe('OK')
    expect(() => service.fail()).toThrow('expected failure')
    expect(service.diagnostics.list().map(record => record.message)).toEqual([
      'demo/ping completed',
      'demo/fail failed',
    ])
  })

  it('validates declared artifact resources', async () => {
    const bytes = new TextEncoder().encode('export default () => undefined')
    const artifact = {
      manifest: {
        protocolVersion: 1 as const,
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        entry: 'index.js',
        entryType: 'plugin' as const,
        resources: [
          {
            path: 'index.js',
            mimeType: 'text/javascript',
            integrity: await sha256Integrity(bytes),
            imports: [],
          },
        ],
      },
      files: [{ path: 'index.js', bytes }],
    }
    await expect(validateArtifact(artifact)).resolves.toMatchObject({ entry: { path: 'index.js' } })
    await expect(
      validateArtifact({ ...artifact, files: [{ path: '../index.js', bytes }] }),
    ).rejects.toThrow('unsafe relative path')
  })

  it('mounts and snapshots a Cordis runtime', async () => {
    const runtime = new CordisRuntime({ source: 'test-runtime' })
    await runtime.mount('dummy', DummyService)
    expect(runtime.list()).toEqual(['dummy'])
    expect(runtime.snapshot().plugins[0]?.state).toBe('active')
    await runtime.dispose()
    expect(runtime.list()).toEqual([])
  })
})