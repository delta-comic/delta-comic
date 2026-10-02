import { describe, expect, it } from 'vitest'

import {
  Context,
  CordisRuntime,
  diagnostic,
  DiagnosticHarness,
  DiagnosticReplayExecutor,
  DiagnosticRecorder,
  EventRecorder,
  createDiagnosticLogger,
  createMinimalRuntime,
  Service,
} from '../lib/index.js'

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

  it('keeps stable context fields and redacts sensitive details by default', () => {
    const recorder = new DiagnosticRecorder({
      source: 'privacy',
      pluginId: 'demo.plugin',
      installationId: 'installation-1',
      id: () => 'event-1',
    })
    const logger = createDiagnosticLogger(recorder, { fiberId: 'fiber-1' })
    logger.info('request completed', { token: 'secret', durationMs: 4 })
    expect(recorder.list()[0]).toMatchObject({
      id: 'event-1',
      pluginId: 'demo.plugin',
      installationId: 'installation-1',
      details: { token: '[redacted]', durationMs: 4 },
    })
  })

  it('records private payloads only when explicitly enabled and replays in order', async () => {
    let now = 100
    const recorder = new EventRecorder({ now: () => now++, id: () => `event-${now}` })
    recorder.start()
    recorder.record('request', { payload: { secret: 'value' }, includePayload: false })
    recorder.record('request', { payload: { itemId: '1' }, includePayload: true, duration: 2 })
    const seen: string[] = []
    await recorder.replay(recorder.stop(), event => {
      seen.push(event.event)
    })
    expect(recorder.list()[0]).not.toHaveProperty('payload')
    expect(recorder.list()[1]).toHaveProperty('payload.itemId', '1')
    expect(seen).toEqual(['request', 'request'])
  })

  it('records operation results and failures with duration metadata', async () => {
    let now = 10
    const recorder = new EventRecorder({ now: () => now++, id: () => 'call-1' })
    recorder.start()
    await expect(recorder.call('load', async () => 'ok')).resolves.toBe('ok')
    await expect(
      recorder.call('fail', async () => {
        throw new Error('bad')
      }),
    ).rejects.toThrow('bad')
    expect(recorder.list()).toEqual([
      expect.objectContaining({ event: 'load', result: 'ok', duration: 1 }),
      expect.objectContaining({ event: 'fail', error: 'bad', duration: 1 }),
    ])
    recorder.stop()
  })

  it('captures, exports, imports, and replays diagnostic records', async () => {
    const recorder = new DiagnosticRecorder({
      source: 'harness',
      id: () => 'record-1',
      now: () => 10,
    })
    recorder.record('info', 'started', { step: 1 })
    const harness = new DiagnosticHarness(recorder)
    const archive = harness.capture()
    const imported = harness.import(harness.export(archive))
    const replayed: string[] = []
    await harness.replay(imported, event => {
      replayed.push(event.message)
    })
    expect(replayed).toEqual(['started'])
    expect(imported.replay[0]?.timestampOffset).toBe(0)
  })

  it('replays archived events through registered handlers and supports disposal', async () => {
    const recorder = new DiagnosticRecorder({ source: 'replay-test', id: () => 'id' })
    recorder.record('info', 'plugin.started', { pluginId: 'demo' })
    recorder.record('warn', 'plugin.failed')
    const harness = new DiagnosticHarness(recorder)
    const executor = new DiagnosticReplayExecutor(harness)
    const seen: string[] = []
    const dispose = executor.register('plugin.started', event => {
      seen.push(event.message)
    })

    await executor.replay(harness.capture())
    dispose()
    await executor.replay(harness.capture())

    expect(seen).toEqual(['plugin.started'])
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

  it('mounts and snapshots a Cordis runtime', async () => {
    const runtime = new CordisRuntime({ source: 'test-runtime' })
    await runtime.mount('dummy', DummyService)
    expect(runtime.list()).toEqual(['dummy'])
    expect(runtime.snapshot().plugins[0]?.state).toBe('active')
    await runtime.dispose()
    expect(runtime.list()).toEqual([])
  })

  it('creates a minimal runtime with mock services', async () => {
    const runtime = await createMinimalRuntime({
      mockServices: { answer: 42 },
      plugins: [
        {
          id: 'minimal',
          module: {
            inject: ['answer'],
            apply(ctx) {
              expect(ctx.answer).toBe(42)
            },
          },
        },
      ],
    })
    expect(runtime.snapshot().fibers[0]).toMatchObject({ id: 'minimal', state: 'active' })
    await runtime.dispose()
  })
})