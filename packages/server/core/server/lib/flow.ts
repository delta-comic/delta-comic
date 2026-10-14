import type { DiagnosticRecorder } from '@delta-comic/both'
import type { Context } from 'cordis'
import jsonLogic, { type RulesLogic } from 'json-logic-js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'

export const FLOW_LIMITS = { steps: 64, depth: 16, http: 16, httpTimeoutMs: 10_000 } as const
const identifier = Type.String({ pattern: '^[A-Za-z0-9_-]{1,64}$' })
const stepSchema = Type.Cyclic(
  {
    Step: Type.Union([
      Type.Object(
        {
          id: identifier,
          op: Type.Literal('if'),
          condition: Type.Unknown(),
          then: Type.Array(Type.Ref('Step')),
          else: Type.Optional(Type.Array(Type.Ref('Step'))),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          id: identifier,
          op: Type.Literal('http'),
          url: Type.Unknown(),
          method: Type.Optional(Type.Unknown()),
          headers: Type.Optional(Type.Unknown()),
          body: Type.Optional(Type.Unknown()),
          response: Type.Optional(
            Type.Union([Type.Literal('json'), Type.Literal('text'), Type.Literal('stream')]),
          ),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        { id: identifier, op: Type.Literal('store.get'), key: Type.Unknown() },
        { additionalProperties: false },
      ),
      Type.Object(
        {
          id: identifier,
          op: Type.Literal('store.set'),
          key: Type.Unknown(),
          value: Type.Unknown(),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        { id: identifier, op: Type.Literal('store.delete'), key: Type.Unknown() },
        { additionalProperties: false },
      ),
      Type.Object(
        { id: identifier, op: Type.Literal('return'), value: Type.Unknown() },
        { additionalProperties: false },
      ),
    ]),
  },
  'Step',
)
export const FlowDocumentSchema = Type.Object(
  {
    version: Type.Literal(1),
    flows: Type.Array(
      Type.Object(
        { id: identifier, steps: Type.Array(stepSchema, { maxItems: 64 }) },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 64 },
    ),
  },
  { additionalProperties: false },
)
export type FlowDocument = Static<typeof FlowDocumentSchema>
export type FlowStep = FlowDocument['flows'][number]['steps'][number]
const flowValidator = Compile(FlowDocumentSchema)

const operators = new Set([
  'var',
  'missing',
  'missing_some',
  'if',
  '?:',
  'and',
  'or',
  '!',
  '!!',
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  '+',
  '-',
  '*',
  '/',
  '%',
  'min',
  'max',
  'cat',
  'substr',
  'in',
  'merge',
])
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor'])
export const isJsonLogic = (value: unknown, depth = 0): value is RulesLogic => {
  if (depth > FLOW_LIMITS.depth) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(item => isJsonLogic(item, depth + 1))
  if (typeof value !== 'object' || value === null) return false
  const entries = Object.entries(value)
  if (entries.length !== 1) return false
  const entry = entries[0]
  if (!entry || !operators.has(entry[0])) return false
  if (entry[0] === 'var') {
    const path = Array.isArray(entry[1]) ? entry[1][0] : entry[1]
    if (typeof path === 'string' && path.split('.').some(key => forbiddenKeys.has(key)))
      return false
  }
  return isJsonLogic(entry[1], depth + 1)
}

const validateValue = (value: unknown, depth = 0): void => {
  if (depth > 32) throw new TypeError('flow value nesting limit exceeded')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (Array.isArray(value)) {
    for (const item of value) validateValue(item, depth + 1)
    return
  }
  if (typeof value !== 'object' || value === null) throw new TypeError('flow value must be JSON')
  const entries = Object.entries(value)
  if (Object.hasOwn(value, 'expr')) {
    if (entries.length !== 1 || !isJsonLogic(entries[0]?.[1]))
      throw new TypeError('invalid JSON logic expression')
    if (JSON.stringify(value).length > 16_384) throw new TypeError('expression size limit exceeded')
    return
  }
  for (const [key, child] of entries) {
    if (forbiddenKeys.has(key)) throw new TypeError(`invalid flow property: ${key}`)
    validateValue(child, depth + 1)
  }
}

export const parseFlowDocument = (value: unknown): FlowDocument => {
  if (!flowValidator.Check(value)) throw new TypeError('invalid flow document schema')
  if (JSON.stringify(value).length > 262_144)
    throw new TypeError('flow document size limit exceeded')
  const flows = new Set<string>()
  for (const flow of value.flows) {
    if (flows.has(flow.id)) throw new TypeError(`duplicate flow id: ${flow.id}`)
    flows.add(flow.id)
    const ids = new Set<string>()
    let count = 0
    const visit = (steps: readonly FlowStep[], depth: number) => {
      if (depth > FLOW_LIMITS.depth) throw new TypeError('flow branch depth limit exceeded')
      for (const step of steps) {
        if (++count > FLOW_LIMITS.steps) throw new TypeError('flow step limit exceeded')
        if (ids.has(step.id)) throw new TypeError(`duplicate step id: ${step.id}`)
        ids.add(step.id)
        for (const [key, parameter] of Object.entries(step)) {
          if (['id', 'op', 'then', 'else'].includes(key)) continue
          validateValue(parameter)
        }
        if (step.op === 'if') {
          visit(step.then, depth + 1)
          visit(step.else ?? [], depth + 1)
        }
      }
    }
    visit(flow.steps, 0)
  }
  return value
}

export const evaluateFlowValue = (value: unknown, data: object): unknown => {
  if (Array.isArray(value)) return value.map(item => evaluateFlowValue(item, data))
  if (typeof value !== 'object' || value === null) return value
  if ('expr' in value && isJsonLogic(value.expr)) return jsonLogic.apply(value.expr, data)
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, evaluateFlowValue(item, data)]),
  )
}

export interface FlowStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}
export interface FlowHttpInput {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
  response: 'json' | 'text' | 'stream'
}
export interface FlowIdentity {
  tenantId: string
  pluginId: string
}
export interface FlowMetrics {
  steps: number
  http: number
  durationMs: number
}
export interface FlowInstallation {
  manifest: import('@delta-comic/shared-plugin-manifest').PluginManifest
  document: FlowDocument
  config: Record<string, unknown>
  enabled: boolean
  schedule?: { flowId: string; intervalHours: number; nextRunAt?: number; enabled: boolean }
}
export interface FlowRun {
  id: string
  tenantId: string
  pluginId: string
  flowId: string
  trigger: 'manual' | 'scheduled'
  status: 'running' | 'succeeded' | 'failed'
  input?: unknown
  result?: unknown
  stepId?: string
  error?: string
  startedAt: number
  completedAt?: number
  metrics: FlowMetrics
}

declare module 'cordis' {
  interface Context {
    identity: FlowIdentity
    input: unknown
    flowConfig: Record<string, unknown>
    store: FlowStore
    http: (input: FlowHttpInput) => Promise<unknown>
    diagnostics: DiagnosticRecorder
  }
}

export type ServerPlugin = (ctx: Context) => void | Promise<void>