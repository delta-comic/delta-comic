import { describe, expect, it, vi } from 'vitest'

import { createServerWorkerAdapter } from '../../lib/serverAdapter'

describe('ServerWorkerAdapter', () => {
  it('records fetch and scheduled lifecycle events', async () => {
    const adapter = createServerWorkerAdapter({
      fetch: () => new Response('ok'),
      scheduled: () => undefined,
    })
    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext

    await expect(
      adapter.fetch(new Request('https://example.test/api/health'), {}, ctx),
    ).resolves.toMatchObject({ status: 200 })
    await adapter.scheduled({ cron: '* * * * *' } as ScheduledController, {}, ctx)

    expect(adapter.diagnostics.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'server worker fetch completed' }),
        expect.objectContaining({ message: 'server worker scheduled completed' }),
      ]),
    )
  })
})