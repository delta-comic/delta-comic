import { Context } from 'cordis'
import { describe, expect, it, vi } from 'vite-plus/test'

import { createFlowHttp, executeFlow } from '../../app/modules/plugins/plugins.flow'
import { FLOW_LIMITS, parseFlowDocument, type FlowStep } from '../../lib/flow'

describe('JSON flow execution', () => {
  it('validates expressions, preserves step results, and returns values', async () => {
    const document = parseFlowDocument({
      version: 1,
      flows: [
        {
          id: 'main',
          steps: [
            {
              id: 'sum',
              op: 'store.set',
              key: 'sum',
              value: { expr: { '+': [{ var: 'input.a' }, { var: 'config.b' }] } },
            },
            { id: 'read', op: 'store.get', key: 'sum' },
            { id: 'return', op: 'return', value: { expr: { var: 'steps.read' } } },
          ],
        },
      ],
    })
    const store = new Map<string, unknown>()
    const ctx = new Context()
    ctx.provide('input', { a: 2 })
    ctx.provide('flowConfig', { b: 3 })
    ctx.provide('store', {
      get: async key => store.get(key),
      set: async (key, value) => void store.set(key, value),
      delete: async key => void store.delete(key),
    })
    ctx.provide('http', vi.fn())
    const metrics = { steps: 0, http: 0, durationMs: 0 }
    await expect(
      executeFlow(ctx, document.flows[0]!.steps, metrics, new AbortController().signal),
    ).resolves.toBe(5)
    expect(metrics.steps).toBe(3)
  })

  it('enforces duplicate IDs and forbidden operators', () => {
    expect(() =>
      parseFlowDocument({
        version: 1,
        flows: [
          {
            id: 'x',
            steps: [
              { id: 'a', op: 'return', value: 1 },
              { id: 'a', op: 'return', value: 2 },
            ],
          },
        ],
      }),
    ).toThrow('duplicate step id')
    expect(() =>
      parseFlowDocument({
        version: 1,
        flows: [{ id: 'x', steps: [{ id: 'a', op: 'return', value: { expr: { eval: 'bad' } } }] }],
      }),
    ).toThrow('invalid JSON logic expression')
  })

  it('uses a bounded abort signal for HTTP requests', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(
      createFlowHttp(
        new AbortController().signal,
        fetcher,
      )({ url: 'https://example.com', method: 'GET', headers: {}, response: 'json' }),
    ).resolves.toMatchObject({ status: 200, body: { ok: true } })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('aborts an HTTP request when its ten-second deadline expires', async () => {
    const fetcher: typeof fetch = async (_input, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    await expect(
      createFlowHttp(
        new AbortController().signal,
        fetcher,
      )({ url: 'https://example.com', method: 'GET', headers: {}, response: 'json' }),
    ).rejects.toMatchObject({ name: 'TimeoutError' })
  }, 12_000)

  it('bounds step count, branch nesting, and HTTP operations', async () => {
    const ctx = new Context()
    ctx.provide('input', null)
    ctx.provide('flowConfig', {})
    ctx.provide('store', { get: async () => null, set: async () => {}, delete: async () => {} })
    const http = vi.fn(async () => null)
    ctx.provide('http', http)
    const steps: FlowStep[] = Array.from({ length: 65 }, (_, index) => ({
      id: 's' + index,
      op: 'store.get',
      key: 'key',
    }))
    expect(() => parseFlowDocument({ version: 1, flows: [{ id: 'main', steps }] })).toThrow()
    await expect(
      executeFlow(ctx, steps, { steps: 0, http: 0, durationMs: 0 }, new AbortController().signal),
    ).rejects.toMatchObject({ stepId: 's64', message: 'flow step limit exceeded' })
    let branches: FlowStep[] = [{ id: 'leaf', op: 'return', value: 1 }]
    for (let index = 0; index < 17; index++)
      branches = [{ id: 'b' + index, op: 'if', condition: true, then: branches }]
    expect(() =>
      parseFlowDocument({ version: 1, flows: [{ id: 'main', steps: branches }] }),
    ).toThrow('flow branch depth limit exceeded')
    const requests: FlowStep[] = Array.from({ length: 17 }, (_, index) => ({
      id: 'h' + index,
      op: 'http',
      url: 'https://example.com',
    }))
    await expect(
      executeFlow(
        ctx,
        requests,
        { steps: 0, http: 0, durationMs: 0 },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ stepId: 'h16', message: 'flow HTTP limit exceeded' })
    expect(http).toHaveBeenCalledTimes(FLOW_LIMITS.http)
    await ctx.fiber.dispose()
  })
})