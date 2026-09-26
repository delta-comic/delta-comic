import { Type, type Static } from 'typebox'

export const PluginManifestSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  version: Type.String({ minLength: 1 }),
  author: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  entry: Type.String({ minLength: 1 }),
  capabilities: Type.Optional(Type.Array(Type.String())),
  permissions: Type.Optional(Type.Array(Type.String())),
})

export type PluginManifest = Static<typeof PluginManifestSchema>

export interface PluginDefinition {
  id: string
  manifest: PluginManifest
  status: 'active' | 'inactive' | 'error'
  error?: string
}