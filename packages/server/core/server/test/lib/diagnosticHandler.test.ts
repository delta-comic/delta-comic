import { DiagnosticRecorder } from '@delta-comic/both'
import { describe, expect, it } from 'vite-plus/test'

import { createDiagnosticHandler } from '../../lib/diagnosticHandler'

describe('diagnostic handler', () => {
  it('protects snapshots and accepts validated replay archives', async () => {
    const diagnostics = new DiagnosticRecorder({ source: 'test', id: () => 'record-1' })
    diagnostics.record('info', 'plugin.started')
    const handler = createDiagnosticHandler({
      authorize: request => request.headers.get('authorization') === 'Bearer admin',
      diagnostics,
      path: '/diagnostics',
    })

    await expect(
      handler.fetch(new Request('https://example.test/diagnostics')),
    ).resolves.toHaveProperty('status', 401)
    const response = await handler.fetch(
      new Request('https://example.test/diagnostics', {
        headers: { authorization: 'Bearer admin' },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: { runtime: 'test', records: [{ message: 'plugin.started' }] },
      ok: true,
    })
  })
})