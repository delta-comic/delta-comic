import semver from 'semver'
import { Type, type Static } from 'typebox'
import { Value } from 'typebox/value'

export const PluginResourceSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  mimeType: Type.String({ minLength: 1 }),
  integrity: Type.String({ pattern: '^sha256-[A-Za-z0-9+/]+={0,2}$' }),
  imports: Type.Array(Type.String()),
})

export const PluginManifestSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$' }),
    name: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    supportCoreVersion: Type.Optional(Type.String({ minLength: 1 })),
    author: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String({ minLength: 1 })),
    entryModulePath: Type.String({ minLength: 1 }),
    resources: Type.Array(PluginResourceSchema),
  },
  { additionalProperties: false },
)

export type PluginResource = Static<typeof PluginResourceSchema>
export type PluginManifest = Static<typeof PluginManifestSchema>
export type PluginMetadata = Omit<PluginManifest, 'entryModulePath' | 'resources'>
export type PluginUserConfig = Record<string, unknown>

export const assertPluginManifestCompatible = (manifest: PluginManifest, coreVersion: string) => {
  if (manifest.supportCoreVersion && !semver.satisfies(coreVersion, manifest.supportCoreVersion)) {
    throw new TypeError(
      `plugin core range ${manifest.supportCoreVersion} does not support ${coreVersion}`,
    )
  }
}

export const isPluginManifest = (value: unknown): value is PluginManifest =>
  Value.Check(PluginManifestSchema, value) &&
  (value.supportCoreVersion === undefined || semver.validRange(value.supportCoreVersion) !== null)

export const parsePluginManifest = (value: unknown): PluginManifest => {
  if (!isPluginManifest(value)) {
    const firstError = Value.Errors(PluginManifestSchema, value)[0]
    throw new TypeError(`invalid plugin manifest${firstError ? `: ${firstError.message}` : ''}`)
  }
  return value
}