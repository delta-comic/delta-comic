import semver from 'semver'
import { Type, type Static } from 'typebox'
import { Value } from 'typebox/value'

export const PLUGIN_PROTOCOL_VERSION = 1 as const

export const PluginDependencySchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  version: Type.Optional(Type.String({ minLength: 1 })),
})

export const PluginResourceSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  mimeType: Type.String({ minLength: 1 }),
  integrity: Type.String({ pattern: '^sha256-[A-Za-z0-9+/]+={0,2}$' }),
  imports: Type.Array(Type.String()),
  platform: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
})

export const PluginManifestSchema = Type.Object({
  protocolVersion: Type.Literal(PLUGIN_PROTOCOL_VERSION),
  id: Type.String({ minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$' }),
  name: Type.String({ minLength: 1 }),
  version: Type.String({ minLength: 1 }),
  apiVersion: Type.Optional(Type.String({ minLength: 1 })),
  cordisVersion: Type.Optional(Type.String({ minLength: 1 })),
  author: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  entry: Type.String({ minLength: 1 }),
  entryType: Type.Union([Type.Literal('plugin'), Type.Literal('plugin-set')]),
  capabilities: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  permissions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  dependencies: Type.Optional(Type.Array(PluginDependencySchema)),
  resources: Type.Array(PluginResourceSchema),
  integrationId: Type.Optional(Type.String({ minLength: 1 })),
})

export type PluginDependency = Static<typeof PluginDependencySchema>
export type PluginResource = Static<typeof PluginResourceSchema>
export type PluginManifest = Static<typeof PluginManifestSchema>

export interface PluginManifestCompatibility {
  readonly apiVersion?: string
  readonly cordisVersion?: string
  readonly protocolVersion?: number
}

export const assertPluginManifestCompatible = (
  manifest: PluginManifest,
  compatibility: PluginManifestCompatibility,
) => {
  if (
    compatibility.protocolVersion !== undefined &&
    manifest.protocolVersion !== compatibility.protocolVersion
  ) {
    throw new TypeError(
      `plugin protocol ${manifest.protocolVersion} is incompatible with ${compatibility.protocolVersion}`,
    )
  }
  if (
    compatibility.apiVersion &&
    manifest.apiVersion &&
    !semver.satisfies(compatibility.apiVersion, manifest.apiVersion)
  ) {
    throw new TypeError(
      `plugin API ${manifest.apiVersion} does not support ${compatibility.apiVersion}`,
    )
  }
  if (
    compatibility.cordisVersion &&
    manifest.cordisVersion &&
    !semver.satisfies(compatibility.cordisVersion, manifest.cordisVersion)
  ) {
    throw new TypeError(
      `plugin Cordis ${manifest.cordisVersion} does not support ${compatibility.cordisVersion}`,
    )
  }
}

export const isPluginManifest = (value: unknown): value is PluginManifest =>
  Value.Check(PluginManifestSchema, value)

export const parsePluginManifest = (value: unknown): PluginManifest => {
  if (!isPluginManifest(value)) {
    const firstError = Value.Errors(PluginManifestSchema, value)[0]
    throw new TypeError(`invalid plugin manifest${firstError ? `: ${firstError.message}` : ''}`)
  }
  return value
}