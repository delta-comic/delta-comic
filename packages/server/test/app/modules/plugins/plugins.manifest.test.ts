import { describe, expect, it } from 'vitest'

import { AppError } from '@/shared/errors'

import {
  normalizeServerPluginConfig,
  validateServerPluginDefinition,
  validateServerPluginManifest,
} from '../../../../app/modules/plugins/plugins.manifest'

const baseManifest = {
  apiVersion: 1 as const,
  author: 'Delta Comic',
  capabilities: ['health.read'],
  configSchema: {
    properties: {
      threshold: {
        defaultValue: 10,
        label: '阈值',
        maximum: 100,
        minimum: 1,
        type: 'number' as const,
      },
    },
  },
  dependencies: [{ id: 'core.base', versionRange: '^1.0.0' }],
  description: 'test plugin',
  id: 'test.plugin',
  name: 'Test plugin',
  version: '1.0.0',
}

describe('server plugin manifest and config validation', () => {
  it('applies defaults and validates a typed config patch', () => {
    const manifest = validateServerPluginManifest(baseManifest)

    expect(normalizeServerPluginConfig(manifest, {})).toEqual({ threshold: 10 })
    expect(normalizeServerPluginConfig(manifest, { threshold: 20 })).toEqual({ threshold: 20 })
  })

  it('rejects unsupported plaintext secret configuration', () => {
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        configSchema: { properties: { token: { label: 'Token', secret: true, type: 'string' } } },
      }),
    ).toThrowError(AppError)
  })

  it('rejects invalid dependency ranges and out-of-range config values', () => {
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        dependencies: [{ id: 'core.base', versionRange: 'not-a-range' }],
      }),
    ).toThrowError(/version range/)

    const manifest = validateServerPluginManifest(baseManifest)
    expect(() => normalizeServerPluginConfig(manifest, { threshold: 101 })).toThrowError(
      /at most 100/,
    )
  })

  it('rejects non-primitive choice values during manifest validation', () => {
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        configSchema: {
          properties: {
            threshold: {
              choices: [{ label: 'invalid', value: { nested: true } }],
              label: '阈值',
              maximum: 100,
              minimum: 1,
              type: 'number',
            },
          },
        },
      }),
    ).toThrowError(/must be number/)
  })

  it('rejects malformed definitions, runtimes, dependency graphs, and duplicate capabilities', () => {
    expect(() => validateServerPluginDefinition(null)).toThrowError(/definition must be an object/)
    expect(() => validateServerPluginDefinition([])).toThrowError(/definition must be an object/)
    expect(() =>
      validateServerPluginDefinition({ manifest: baseManifest, runtime: [] }),
    ).toThrowError(/runtime must be an object/)
    expect(() =>
      validateServerPluginDefinition({ manifest: baseManifest, runtime: { start: true } }),
    ).toThrowError(/runtime hook start must be a function/)
    expect(() =>
      validateServerPluginManifest({ ...baseManifest, dependencies: [{ id: baseManifest.id }] }),
    ).toThrowError(/cannot depend on itself/)
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        dependencies: [{ id: 'core.base' }, { id: 'core.base' }],
      }),
    ).toThrowError(/duplicate plugin dependency/)
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        capabilities: ['health.read', 'health.read'],
      }),
    ).toThrowError(/capabilities must be unique/)
  })

  it('rejects inverted numeric/string schema constraints and invalid manifest shapes', () => {
    expect(() => validateServerPluginManifest({ id: 'incomplete' })).toThrowError(
      /manifest validation failed/,
    )
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        configSchema: {
          properties: { threshold: { label: '阈值', maximum: 1, minimum: 2, type: 'number' } },
        },
      }),
    ).toThrowError(/minimum cannot exceed maximum/)
    expect(() =>
      validateServerPluginManifest({
        ...baseManifest,
        configSchema: {
          properties: { label: { label: '名称', maxLength: 1, minLength: 2, type: 'string' } },
        },
      }),
    ).toThrowError(/minLength cannot exceed maxLength/)
  })

  it('enforces required, primitive, numeric, string, choice, and unknown-field config rules', () => {
    const manifest = validateServerPluginManifest({
      ...baseManifest,
      configSchema: {
        properties: {
          count: { label: '数量', maximum: 4, minimum: 2, required: true, type: 'number' },
          mode: {
            choices: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
            label: '模式',
            maxLength: 2,
            minLength: 1,
            type: 'string',
          },
        },
      },
    })

    expect(() => normalizeServerPluginConfig(manifest, {})).toThrowError(/count is required/)
    expect(() => normalizeServerPluginConfig(manifest, { count: null })).toThrowError(
      /count is required/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: '2' })).toThrowError(
      /count must be number/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: Number.NaN })).toThrowError(
      /count must be finite/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: 1 })).toThrowError(/at least 2/)
    expect(() => normalizeServerPluginConfig(manifest, { count: 5 })).toThrowError(/at most 4/)
    expect(() => normalizeServerPluginConfig(manifest, { count: 2, mode: '' })).toThrowError(
      /at least 1 characters/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: 2, mode: 'abc' })).toThrowError(
      /at most 2 characters/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: 2, mode: 'c' })).toThrowError(
      /not an allowed choice/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: 2, unknown: true })).toThrowError(
      /unknown plugin config field/,
    )
    expect(() => normalizeServerPluginConfig(manifest, [])).toThrowError(
      /plugin config must be an object/,
    )
    expect(() => normalizeServerPluginConfig(manifest, { count: { nested: true } })).toThrowError(
      /must contain a primitive value/,
    )
    expect(normalizeServerPluginConfig(manifest, { count: 2, mode: null })).toEqual({
      count: 2,
      mode: null,
    })
  })

  it('allows explicitly declared additional primitive config fields', () => {
    const manifest = validateServerPluginManifest({
      ...baseManifest,
      configSchema: { additionalProperties: true, properties: {} },
    })
    expect(normalizeServerPluginConfig(manifest, { custom: 'value' })).toEqual({ custom: 'value' })
  })
})