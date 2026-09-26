import { PluginManifestSchema } from '@delta-comic/both/manifest'
import { Type, type Static } from 'typebox'

export const ServerRouteSchema = Type.Object({
  method: Type.Union([
    Type.Literal('GET'),
    Type.Literal('POST'),
    Type.Literal('PUT'),
    Type.Literal('PATCH'),
    Type.Literal('DELETE'),
  ]),
  path: Type.String({ minLength: 1 }),
  public: Type.Optional(Type.Boolean()),
  permission: Type.Optional(Type.String({ minLength: 1 })),
})

export const ServerCronSchema = Type.Object({
  schedule: Type.String({ minLength: 1 }),
  id: Type.String({ minLength: 1 }),
})

export const ServerPluginManifestSchema = Type.Intersect([
  PluginManifestSchema,
  Type.Object({
    routes: Type.Array(ServerRouteSchema),
    crons: Type.Array(ServerCronSchema),
    queues: Type.Array(Type.String({ minLength: 1 })),
    migrations: Type.Array(Type.String({ minLength: 1 })),
  }),
])

export type ServerRoute = Static<typeof ServerRouteSchema>
export type ServerCron = Static<typeof ServerCronSchema>
export type ServerPluginArtifactManifest = Static<typeof ServerPluginManifestSchema>