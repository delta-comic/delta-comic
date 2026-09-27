import { Type, type Static } from 'typebox'
import { Value } from 'typebox/value'

const httpsUrl = Type.String({ pattern: '^https://[^\\s]+$' })

export const PluginReleaseArtifactSchema = Type.Object({
  platform: Type.String({ minLength: 1 }),
  url: httpsUrl,
  mimeType: Type.String({ minLength: 1 }),
  size: Type.Integer({ minimum: 0 }),
  integrity: Type.String({ pattern: '^sha256-[A-Za-z0-9+/]+={0,2}$' }),
})

export const PluginReleaseSchema = Type.Object({
  pluginId: Type.String({ minLength: 1 }),
  version: Type.String({ minLength: 1 }),
  manifestUrl: httpsUrl,
  artifacts: Type.Array(PluginReleaseArtifactSchema, { minItems: 1 }),
  publishedAt: Type.String({ minLength: 1 }),
  yanked: Type.Optional(Type.Boolean()),
})

export const PluginCatalogEntrySchema = Type.Object({
  pluginId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  releases: Type.Array(PluginReleaseSchema),
})

export const PluginCatalogIndexSchema = Type.Object({
  protocolVersion: Type.Literal(1),
  generatedAt: Type.String({ minLength: 1 }),
  entries: Type.Array(PluginCatalogEntrySchema),
})

export type PluginReleaseArtifact = Static<typeof PluginReleaseArtifactSchema>
export type PluginRelease = Static<typeof PluginReleaseSchema>
export type PluginCatalogEntry = Static<typeof PluginCatalogEntrySchema>
export type PluginCatalogIndex = Static<typeof PluginCatalogIndexSchema>

const parse = <T>(schema: object, value: unknown, label: string): T => {
  if (!Value.Check(schema, value)) {
    const firstError = Value.Errors(schema, value)[0]
    throw new TypeError(`invalid ${label}${firstError ? `: ${firstError.message}` : ''}`)
  }
  return value as T
}

export const parsePluginRelease = (value: unknown) =>
  parse<PluginRelease>(PluginReleaseSchema, value, 'plugin release')

export const parsePluginCatalogIndex = (value: unknown) =>
  parse<PluginCatalogIndex>(PluginCatalogIndexSchema, value, 'plugin catalog index')

export const findPluginRelease = (
  index: PluginCatalogIndex,
  pluginId: string,
  version?: string,
) => {
  const entry = index.entries.find(item => item.pluginId === pluginId)
  if (!entry) return undefined
  return entry.releases.find(
    release => !release.yanked && (!version || release.version === version),
  )
}