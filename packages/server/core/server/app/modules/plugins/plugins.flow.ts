import { Context } from 'cordis'
import jsonLogic from 'json-logic-js'

import {
  FLOW_LIMITS,
  evaluateFlowValue,
  type FlowStep,
  type FlowHttpInput,
  type FlowMetrics,
} from '../../../lib/flow'

export class FlowExecutionError extends Error {
  constructor(
    readonly stepId: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'FlowExecutionError'
  }
}

const stringValue = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.length)
    throw new TypeError(`${field} must be a nonempty string`)
  return value
}

export const executeFlow = async (
  ctx: Context,
  steps: readonly FlowStep[],
  metrics: FlowMetrics,
  signal: AbortSignal,
): Promise<unknown> => {
  const results: Record<string, unknown> = {}
  const data = { input: ctx.input, config: ctx.flowConfig, steps: results }
  const evaluate = (value: unknown) => evaluateFlowValue(value, data)
  const execute = async (
    group: readonly FlowStep[],
    depth: number,
  ): Promise<{ value: unknown } | undefined> => {
    for (const step of group) {
      try {
        signal.throwIfAborted()
        if (++metrics.steps > FLOW_LIMITS.steps) throw new Error('flow step limit exceeded')
        if (depth > FLOW_LIMITS.depth) throw new Error('flow branch depth limit exceeded')
        switch (step.op) {
          case 'if': {
            const matched = jsonLogic.truthy(evaluate(step.condition))
            const returned = await execute(matched ? step.then : (step.else ?? []), depth + 1)
            results[step.id] = matched
            if (returned) return returned
            break
          }
          case 'http': {
            if (++metrics.http > FLOW_LIMITS.http) throw new Error('flow HTTP limit exceeded')
            const headers = evaluate(step.headers ?? {})
            if (typeof headers !== 'object' || headers === null || Array.isArray(headers))
              throw new TypeError('HTTP headers must be an object')
            const entries = Object.entries(headers).map(([key, value]) => [
              key,
              stringValue(value, 'HTTP header'),
            ])
            results[step.id] = await ctx.http({
              url: stringValue(evaluate(step.url), 'HTTP URL'),
              method: stringValue(evaluate(step.method ?? 'GET'), 'HTTP method'),
              headers: Object.fromEntries(entries),
              body: evaluate(step.body),
              response: step.response ?? 'json',
            })
            break
          }
          case 'store.get':
            results[step.id] = await ctx.store.get(stringValue(evaluate(step.key), 'store key'))
            break
          case 'store.set': {
            const value = evaluate(step.value)
            await ctx.store.set(stringValue(evaluate(step.key), 'store key'), value)
            results[step.id] = value
            break
          }
          case 'store.delete':
            await ctx.store.delete(stringValue(evaluate(step.key), 'store key'))
            results[step.id] = null
            break
          case 'return':
            return { value: evaluate(step.value) }
        }
      } catch (error) {
        throw error instanceof FlowExecutionError ? error : new FlowExecutionError(step.id, error)
      }
    }
  }
  return (await execute(steps, 0))?.value ?? null
}

export const createFlowHttp =
  (signal: AbortSignal, fetcher: typeof fetch = fetch) =>
  async (input: FlowHttpInput): Promise<unknown> => {
    const url = new URL(input.url)
    if (!['http:', 'https:'].includes(url.protocol))
      throw new TypeError('HTTP URL protocol must be http or https')
    const headers = new Headers(input.headers)
    let body: string | undefined
    if (input.body !== undefined) {
      body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body)
      if (typeof input.body !== 'string' && !headers.has('content-type'))
        headers.set('content-type', 'application/json')
    }
    const response = await fetcher(url, {
      method: input.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(FLOW_LIMITS.httpTimeoutMs)]),
    })
    if (input.response === 'stream') return response
    const result: unknown =
      input.response === 'text' ? await response.text() : await response.json()
    return { status: response.status, headers: Object.fromEntries(response.headers), body: result }
  }