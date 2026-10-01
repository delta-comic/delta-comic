import { describe, expect, it } from 'vitest'

import {
  Context,
  CordisRuntime,
  diagnostic,
  DiagnosticHarness,
  DiagnosticReplayExecutor,
  DiagnosticRecorder,
  findPluginRelease,
  parsePluginCatalogIndex,
  parsePluginRelease,
  createHttpPluginCatalogStore,
  createMemoryPluginCatalogStore,
  createPluginReleasePublisher,
  Service,
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

  it('validates release metadata and resolves a non-yanked catalog release', () => {
    const release = parsePluginRelease({
      pluginId: 'demo',
      version: '1.0.0',
      manifestUrl: 'https://plugins.example/demo/1.0.0/manifest.json',
      artifacts: [
        {
          platform: 'desktop',
          url: 'https://plugins.example/demo/1.0.0/desktop.zip',
          mimeType: 'application/zip',
          size: 42,
          integrity: 'sha256-YWJj',
        },
      ],
      publishedAt: '2026-09-27T00:00:00Z',
    })
    const index = parsePluginCatalogIndex({
      protocolVersion: 1,
      generatedAt: '2026-09-27T00:00:00Z',
      entries: [
        { pluginId: 'demo', name: 'Demo', releases: [{ ...release, yanked: true }, release] },
      ],
    })
    expect(findPluginRelease(index, 'demo')?.version).toBe('1.0.0')
    expect(() =>
      parsePluginRelease({ ...release, manifestUrl: 'http://insecure.test/manifest' }),
    ).toThrow('invalid plugin release')
  })

  it('reads and writes catalog indexes through injected stores', async () => {
    const memory = createMemoryPluginCatalogStore()
    await memory.save({ protocolVersion: 1, generatedAt: 'now', entries: [] })
    await expect(memory.load()).resolves.toMatchObject({ entries: [] })

    const requests: RequestInit[] = []
    const http = createHttpPluginCatalogStore(
      'https://plugins.example/catalog.json',
      async (_url, init) => {
        requests.push(init ?? {})
        return {
          ok: true,
          status: 200,
          async json() {
            return { protocolVersion: 1, generatedAt: 'now', entries: [] }
          },
        }
      },
    )
    await expect(http.load()).resolves.toMatchObject({ entries: [] })
    await http.save({ protocolVersion: 1, generatedAt: 'now', entries: [] })
    expect(requests[0]?.headers).toMatchObject({ accept: 'application/json' })
    expect(requests[1]?.method).toBe('PUT')
  })

  it('publishes and yanks releases with one catalog save per update', async () => {
    const store = createMemoryPluginCatalogStore()
    const publisher = createPluginReleasePublisher(store)
    const release = parsePluginRelease({
      pluginId: 'publisher-demo',
      version: '1.0.0',
      manifestUrl: 'https://plugins.example/publisher-demo/1.0.0/manifest.json',
      artifacts: [
        {
          platform: 'desktop',
          url: 'https://plugins.example/publisher-demo/1.0.0/desktop.zip',
          mimeType: 'application/zip',
          size: 1,
          integrity: 'sha256-YQ==',
        },
      ],
      publishedAt: '2026-09-27T00:00:00Z',
    })

    await publisher.publish(release, { name: 'Publisher demo' })
    await expect(publisher.publish(release, { name: 'Publisher demo' })).rejects.toThrow(
      'release already exists',
    )
    await publisher.yank('publisher-demo', '1.0.0')
    expect(findPluginRelease((await store.load())!, 'publisher-demo')).toBeUndefined()
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