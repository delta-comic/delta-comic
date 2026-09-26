import { PluginManifestSchema } from '@delta-comic/both/manifest'
import { Type, type Static } from 'typebox'

export const ClientRouteSchema = Type.Object({
  path: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  navigation: Type.Optional(Type.Boolean()),
})

export const ClientPluginManifestSchema = Type.Intersect([
  PluginManifestSchema,
  Type.Object({
    routes: Type.Array(ClientRouteSchema),
    platforms: Type.Optional(
      Type.Array(Type.Union([Type.Literal('desktop'), Type.Literal('android')])),
    ),
  }),
])

export type ClientRoute = Static<typeof ClientRouteSchema>
export type ClientPluginManifest = Static<typeof ClientPluginManifestSchema>