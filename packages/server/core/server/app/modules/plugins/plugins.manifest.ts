import { Value } from '@sinclair/typebox/value'
import { t } from 'elysia'
import { validRange } from 'semver'

import { AppError } from '@/shared/errors'

import type {
  ServerPluginConfig,
  ServerPluginConfigField,
  ServerPluginConfigValue,
  ServerPluginDefinition,
  ServerPluginManifest,
  ServerPluginRuntime,
} from '../../../lib/plugin'
import { SERVER_PLUGIN_API_VERSION } from '../../../lib/plugin'

export const pluginIdPattern = '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$'
const versionPattern = '^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$'

// Elysia's response normalizer currently warns on TypeBox unions under Workers.
// Runtime validation below still enforces the primitive config-value contract.
export const pluginConfigValueSchema = t.Any()

export const pluginConfigChoiceSchema = t.Object({
  label: t.String({ maxLength: 120, minLength: 1 }),
  value: pluginConfigValueSchema,
})

export const pluginConfigFieldSchema = t.Object({
  choices: t.Optional(t.Array(pluginConfigChoiceSchema, { maxItems: 100 })),
  defaultValue: t.Optional(pluginConfigValueSchema),
  description: t.Optional(t.String({ maxLength: 1000 })),
  label: t.String({ maxLength: 120, minLength: 1 }),
  maximum: t.Optional(t.Number()),
  maxLength: t.Optional(t.Number({ minimum: 0 })),
  minimum: t.Optional(t.Number()),
  minLength: t.Optional(t.Number({ minimum: 0 })),
  required: t.Optional(t.Boolean()),
  secret: t.Optional(t.Boolean()),
  type: t.UnionEnum(['boolean', 'number', 'string']),
})

export const pluginConfigSchemaSchema = t.Object({
  additionalProperties: t.Optional(t.Boolean()),
  properties: t.Record(t.String({ maxLength: 80, minLength: 1 }), pluginConfigFieldSchema),
})

export const serverPluginManifestSchema = t.Object({
  apiVersion: t.Literal(SERVER_PLUGIN_API_VERSION),
  author: t.String({ maxLength: 160, minLength: 1 }),
  capabilities: t.Array(t.String({ maxLength: 120, minLength: 1 }), { maxItems: 100 }),
  configSchema: pluginConfigSchemaSchema,
  dependencies: t.Array(
    t.Object({
      id: t.String({ maxLength: 160, minLength: 1, pattern: pluginIdPattern }),
      versionRange: t.Optional(t.String({ maxLength: 80, minLength: 1 })),
    }),
    { maxItems: 100 },
  ),
  description: t.String({ maxLength: 2000 }),
  id: t.String({ maxLength: 160, minLength: 1, pattern: pluginIdPattern }),
  name: t.String({ maxLength: 160, minLength: 1 }),
  version: t.String({ maxLength: 80, minLength: 1, pattern: versionPattern }),
})

const runtimeHookNames = ['health', 'install', 'start', 'stop', 'uninstall', 'update'] as const

const validationDetails = (schema: Parameters<typeof Value.Errors>[0], value: unknown) =>
  [...Value.Errors(schema, value)]
    .slice(0, 12)
    .map(error => ({ message: error.message, path: error.path }))

export const validateServerPluginManifest = (value: unknown): ServerPluginManifest => {
  if (!Value.Check(serverPluginManifestSchema, value)) {
    throw new AppError(
      'PLUGIN_INVALID_MANIFEST',
      'server plugin manifest validation failed',
      400,
      validationDetails(serverPluginManifestSchema, value),
    )
  }

  const manifest = value as ServerPluginManifest
  const dependencyIds = new Set<string>()
  for (const dependency of manifest.dependencies) {
    if (dependency.id === manifest.id) {
      throw new AppError('PLUGIN_SELF_DEPENDENCY', 'plugin cannot depend on itself', 400)
    }
    if (dependencyIds.has(dependency.id)) {
      throw new AppError(
        'PLUGIN_DUPLICATE_DEPENDENCY',
        `duplicate plugin dependency: ${dependency.id}`,
        400,
      )
    }
    dependencyIds.add(dependency.id)
    if (dependency.versionRange && !validRange(dependency.versionRange)) {
      throw new AppError(
        'PLUGIN_INVALID_VERSION_RANGE',
        `invalid version range for dependency ${dependency.id}`,
        400,
      )
    }
  }

  if (new Set(manifest.capabilities).size !== manifest.capabilities.length) {
    throw new AppError('PLUGIN_DUPLICATE_CAPABILITY', 'plugin capabilities must be unique', 400)
  }

  for (const [key, field] of Object.entries(manifest.configSchema.properties)) {
    if (field.secret) {
      throw new AppError(
        'PLUGIN_CONFIG_SECRET_UNSUPPORTED',
        `secret config field ${key} must use a Worker secret or scoped host capability`,
        400,
      )
    }
    if (
      field.minimum !== undefined &&
      field.maximum !== undefined &&
      field.minimum > field.maximum
    ) {
      throw new AppError(
        'PLUGIN_INVALID_CONFIG_SCHEMA',
        `minimum cannot exceed maximum for config field ${key}`,
        400,
      )
    }
    if (
      field.minLength !== undefined &&
      field.maxLength !== undefined &&
      field.minLength > field.maxLength
    ) {
      throw new AppError(
        'PLUGIN_INVALID_CONFIG_SCHEMA',
        `minLength cannot exceed maxLength for config field ${key}`,
        400,
      )
    }
    if (field.defaultValue !== undefined) validateConfigFieldValue(key, field, field.defaultValue)
    for (const choice of field.choices ?? []) validateConfigFieldValue(key, field, choice.value)
  }

  return manifest
}

const validateRuntime = (value: unknown): ServerPluginRuntime => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('PLUGIN_INVALID_RUNTIME', 'plugin runtime must be an object', 400)
  }
  const runtime = value as Record<string, unknown>
  for (const hook of runtimeHookNames) {
    if (runtime[hook] !== undefined && typeof runtime[hook] !== 'function') {
      throw new AppError(
        'PLUGIN_INVALID_RUNTIME',
        `plugin runtime hook ${hook} must be a function`,
        400,
      )
    }
  }
  return value as ServerPluginRuntime
}

export const validateServerPluginDefinition = (value: unknown): ServerPluginDefinition => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(
      'PLUGIN_INVALID_DEFINITION',
      'server plugin definition must be an object',
      400,
    )
  }
  const candidate = value as { manifest?: unknown; runtime?: unknown }
  return {
    manifest: validateServerPluginManifest(candidate.manifest),
    runtime: validateRuntime(candidate.runtime),
  }
}

const valueMatchesChoice = (value: ServerPluginConfigValue, choice: ServerPluginConfigValue) =>
  Object.is(value, choice)

const validateConfigFieldValue = (
  key: string,
  field: ServerPluginConfigField,
  value: ServerPluginConfigValue,
): void => {
  if (value === null) {
    if (field.required) {
      throw new AppError('PLUGIN_CONFIG_REQUIRED', `config field ${key} is required`, 400)
    }
    return
  }
  if (typeof value !== field.type) {
    throw new AppError(
      'PLUGIN_CONFIG_TYPE_MISMATCH',
      `config field ${key} must be ${field.type}`,
      400,
    )
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AppError('PLUGIN_CONFIG_INVALID_NUMBER', `config field ${key} must be finite`, 400)
    }
    if (field.minimum !== undefined && value < field.minimum) {
      throw new AppError(
        'PLUGIN_CONFIG_OUT_OF_RANGE',
        `config field ${key} must be at least ${field.minimum}`,
        400,
      )
    }
    if (field.maximum !== undefined && value > field.maximum) {
      throw new AppError(
        'PLUGIN_CONFIG_OUT_OF_RANGE',
        `config field ${key} must be at most ${field.maximum}`,
        400,
      )
    }
  }
  if (typeof value === 'string') {
    if (field.minLength !== undefined && value.length < field.minLength) {
      throw new AppError(
        'PLUGIN_CONFIG_INVALID_LENGTH',
        `config field ${key} must contain at least ${field.minLength} characters`,
        400,
      )
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      throw new AppError(
        'PLUGIN_CONFIG_INVALID_LENGTH',
        `config field ${key} must contain at most ${field.maxLength} characters`,
        400,
      )
    }
  }
  if (field.choices && !field.choices.some(choice => valueMatchesChoice(value, choice.value))) {
    throw new AppError(
      'PLUGIN_CONFIG_INVALID_CHOICE',
      `config field ${key} is not an allowed choice`,
      400,
    )
  }
}

const assertConfigRecord = (value: unknown): ServerPluginConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('PLUGIN_INVALID_CONFIG', 'plugin config must be an object', 400)
  }
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && !['boolean', 'number', 'string'].includes(typeof item)) {
      throw new AppError(
        'PLUGIN_CONFIG_TYPE_MISMATCH',
        `config field ${key} must contain a primitive value`,
        400,
      )
    }
  }
  return value as ServerPluginConfig
}

export const normalizeServerPluginConfig = (
  manifest: ServerPluginManifest,
  patch: unknown,
  current: ServerPluginConfig = {},
): ServerPluginConfig => {
  const patchRecord = assertConfigRecord(patch)
  const properties = manifest.configSchema.properties
  if (!manifest.configSchema.additionalProperties) {
    const unknownKey = Object.keys(patchRecord).find(key => !(key in properties))
    if (unknownKey) {
      throw new AppError(
        'PLUGIN_CONFIG_UNKNOWN_FIELD',
        `unknown plugin config field: ${unknownKey}`,
        400,
      )
    }
  }

  const result: ServerPluginConfig = { ...current, ...patchRecord }
  for (const [key, field] of Object.entries(properties)) {
    let value = result[key]
    if (value === undefined && field.defaultValue !== undefined) {
      value = field.defaultValue
      result[key] = value
    }
    if (value === undefined) {
      if (field.required) {
        throw new AppError('PLUGIN_CONFIG_REQUIRED', `config field ${key} is required`, 400)
      }
      continue
    }
    validateConfigFieldValue(key, field, value)
  }
  return result
}