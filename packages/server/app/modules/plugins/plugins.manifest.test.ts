import { describe, expect, it } from 'vitest'

import { AppError } from '@/shared/errors'

import { normalizeServerPluginConfig, validateServerPluginManifest } from './plugins.manifest'

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
})