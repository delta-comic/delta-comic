import { describe, expect, it } from 'vitest'

import { Context, DiagnosticRecorder, Service, withDiagnostic } from '../lib/index.js'

declare module 'cordis' {
  interface Context {
    answer: number
  }
}

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

describe('@delta-comic/both cordis integration', () => {
  it('mounts service properly', async () => {
    const ctx = new Context()
    await ctx.plugin(DummyService)
    expect(ctx.dummy).toBeDefined()
    expect(ctx.dummy.ping()).toBe('pong')
  })

  it('records bounded diagnostics and redacts sensitive details', () => {
    const recorder = new DiagnosticRecorder({ source: 'test', capacity: 2, pluginId: 'demo' })
    recorder.record('info', 'one')
    recorder.record('warn', 'two', { token: 'secret', durationMs: 4 })
    recorder.record('error', 'three')
    expect(recorder.list().map(record => record.message)).toEqual(['two', 'three'])
    expect(recorder.list()[0]).toMatchObject({
      pluginId: 'demo',
      details: { token: '[redacted]', durationMs: 4 },
    })
    expect(recorder.snapshot().runtime).toBe('test')
  })

  it('records operation completion and failure', async () => {
    const recorder = new DiagnosticRecorder({ source: 'test' })
    await expect(withDiagnostic(recorder, 'ping', () => 'ok')).resolves.toBe('ok')
    await expect(
      withDiagnostic(recorder, 'fail', () => {
        throw new Error('expected failure')
      }),
    ).rejects.toThrow('expected failure')
    expect(recorder.list().map(record => record.message)).toEqual(['ping completed', 'fail failed'])
  })
})