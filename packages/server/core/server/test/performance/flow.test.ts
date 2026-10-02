import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { Miniflare } from 'miniflare'
import { Type } from 'typebox'
import { Value } from 'typebox/value'
import { build } from 'vite-plus'
import { expect, it } from 'vite-plus/test'

const profileSchema = Type.Object({
  nodes: Type.Array(
    Type.Object({
      id: Type.Number(),
      callFrame: Type.Object({ functionName: Type.String(), url: Type.String() }),
    }),
  ),
  samples: Type.Array(Type.Number()),
  timeDeltas: Type.Array(Type.Number()),
})
const measurementSchema = Type.Object({
  run: Type.Object({
    status: Type.Literal('succeeded'),
    metrics: Type.Object({ steps: Type.Number(), http: Type.Number() }),
  }),
  database: Type.Object({
    queries: Type.Number(),
    rowsRead: Type.Number(),
    rowsWritten: Type.Number(),
    durationMs: Type.Number(),
  }),
  httpRequests: Type.Number(),
})

it('measures representative flows in workerd with local D1 and HTTP', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-flow-profile-'))
  const profiles = process.env.FLOW_PROFILE_DIR
  if (profiles) await mkdir(profiles, { recursive: true })
  const fixture = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end('{"value":2}')
  })
  let mf: Miniflare | undefined
  let socket: WebSocket | undefined
  try {
    fixture.listen(0, '127.0.0.1')
    await once(fixture, 'listening')
    const address = fixture.address()
    if (!address || typeof address === 'string') throw new Error('HTTP fixture address required')
    const httpUrl = `http://127.0.0.1:${address.port}`
    await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '@': fileURLToPath(new URL('../../app', import.meta.url)) } },
      build: {
        outDir: directory,
        lib: {
          entry: fileURLToPath(new URL('./flow.worker.ts', import.meta.url)),
          formats: ['es'],
          fileName: 'worker',
        },
        target: 'esnext',
        minify: false,
      },
    })
    mf = new Miniflare({
      inspectorPort: 0,
      workers: [
        {
          config: {
            name: 'flow-profile',
            compatibilityDate: '2026-07-02',
            compatibilityFlags: ['nodejs_compat'],
            manifest: {
              mainModule: 'worker.js',
              modulesRoot: '/',
              modules: {
                'worker.js': {
                  type: 'esm',
                  contents: await readFile(join(directory, 'worker.js'), 'utf8'),
                },
              },
            },
            env: { DB: { type: 'd1', id: 'profile-db' } },
          },
        },
      ],
    })
    const db = await mf.getD1Database('DB')
    const migration = await readFile(
      new URL('../../migrations/0005_plugin_flows.sql', import.meta.url),
      'utf8',
    )
    for (const sql of migration.split(';').filter(sql => sql.trim())) await db.prepare(sql).run()
    const inspector = await mf.getInspectorURL()
    socket = new WebSocket(new URL('/core:user:flow-profile', inspector.href).href)
    await new Promise<void>((resolve, reject) => {
      socket?.addEventListener('open', () => resolve(), { once: true })
      socket?.addEventListener('error', reject, { once: true })
    })
    const callbacks = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: unknown) => void }
    >()
    let sequence = 0
    socket.addEventListener('message', event => {
      const message: unknown = JSON.parse(String(event.data))
      if (
        typeof message !== 'object' ||
        message === null ||
        !('id' in message) ||
        typeof message.id !== 'number'
      )
        return
      const callback = callbacks.get(message.id)
      if (!callback) return
      callbacks.delete(message.id)
      if ('error' in message) callback.reject(message.error)
      else callback.resolve('result' in message ? message.result : undefined)
    })
    const command = (method: string, params = {}): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const id = ++sequence
        callbacks.set(id, { resolve, reject })
        socket?.send(JSON.stringify({ id, method, params }))
      })
    await command('Profiler.enable')
    await command('Profiler.setSamplingInterval', { interval: 1000 })
    const samples = 30
    for (const scenario of ['return', 'store', 'http']) {
      const installUrl = new URL('http://localhost/install')
      installUrl.searchParams.set('scenario', scenario)
      installUrl.searchParams.set('httpUrl', httpUrl)
      expect((await mf.dispatchFetch(installUrl.href)).status).toBe(200)
      const runUrl = `http://localhost/run?scenario=${scenario}`
      for (let index = 0; index < 5; index++) await (await mf.dispatchFetch(runUrl)).text()
      await command('Profiler.start')
      const measurements = []
      const durations = []
      for (let index = 0; index < samples; index++) {
        const started = performance.now()
        const result: unknown = await (await mf.dispatchFetch(runUrl)).json()
        durations.push(performance.now() - started)
        if (!Value.Check(measurementSchema, result)) throw new Error('invalid measurement response')
        measurements.push(result)
        expect(result.database.queries + 3).toBeLessThanOrEqual(50)
        expect(result.httpRequests).toBe(result.run.metrics.http)
      }
      const result = await command('Profiler.stop')
      if (
        typeof result !== 'object' ||
        result === null ||
        !('profile' in result) ||
        !Value.Check(profileSchema, result.profile)
      )
        throw new Error('CPU profile required')
      const profile = result.profile
      if (profiles)
        await writeFile(join(profiles, `${scenario}.cpuprofile`), JSON.stringify(profile))
      const idle = new Set(
        profile.nodes
          .filter(node => ['(idle)', '(root)', '(program)'].includes(node.callFrame.functionName))
          .map(node => node.id),
      )
      const activeUs = profile.samples.reduce(
        (total, id, index) => total + (idle.has(id) ? 0 : (profile.timeDeltas[index] ?? 0)),
        0,
      )
      const sourceTimes = new Map<string, number>()
      const frameTimes = new Map<string, number>()
      for (const [index, id] of profile.samples.entries()) {
        const node = profile.nodes.find(node => node.id === id)
        const name = node?.callFrame.functionName ?? 'unknown'
        frameTimes.set(name, (frameTimes.get(name) ?? 0) + (profile.timeDeltas[index] ?? 0))
        const source = node?.callFrame.url ?? ''
        sourceTimes.set(source, (sourceTimes.get(source) ?? 0) + (profile.timeDeltas[index] ?? 0))
      }
      const mean = (values: number[]) =>
        values.reduce((total, value) => total + value, 0) / values.length
      const measurement = {
        scenario,
        samples,
        sampledActiveMs: activeUs / 1000 / samples,
        applicationJsMs: (sourceTimes.get('worker.js') ?? 0) / 1000 / samples,
        sources: [...sourceTimes].map(([source, us]) => ({
          source,
          msPerRun: us / 1000 / samples,
        })),
        topFrames: [...frameTimes]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 8)
          .map(([name, us]) => ({ name, msPerRun: us / 1000 / samples })),
        wallMs: mean(durations),
        database: {
          queries: mean(measurements.map(item => item.database.queries)),
          rowsRead: mean(measurements.map(item => item.database.rowsRead)),
          rowsWritten: mean(measurements.map(item => item.database.rowsWritten)),
          durationMs: mean(measurements.map(item => item.database.durationMs)),
        },
        httpRequests: mean(measurements.map(item => item.httpRequests)),
      }
      if (profiles)
        await writeFile(join(profiles, `${scenario}.json`), JSON.stringify(measurement, null, 2))
      console.info('FLOW_RESOURCE_MEASUREMENT', JSON.stringify(measurement))
    }
  } finally {
    socket?.close()
    await mf?.dispose()
    await new Promise<void>(resolve => fixture.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)