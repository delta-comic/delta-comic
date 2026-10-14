import Elysia, { t } from 'elysia'

import { apiSuccessSchema } from '@/shared/response'

export const terminalSchema = {
  appVersion: t.Optional(t.String({ maxLength: 64 })),
  platform: t.Optional(t.String({ maxLength: 64 })),
  terminalName: t.Optional(t.String({ maxLength: 128 })),
  terminalUuid: t.String({ format: 'uuid' }),
}

export const registerSchema = t.Object({
  ...terminalSchema,
  loginName: t.String({ maxLength: 64, minLength: 3 }),
  password: t.String({ maxLength: 256, minLength: 8 }),
})

export const loginSchema = registerSchema

export const refreshSchema = t.Object({ refreshToken: t.String({ minLength: 16 }) })

export const authTokensResponseSchema = t.Object({
  terminal: t.Object({
    displayName: t.Optional(t.String()),
    terminalUuid: t.String({ format: 'uuid' }),
  }),
  tokens: t.Object({
    accessExpiresAt: t.Number(),
    accessToken: t.String(),
    refreshExpiresAt: t.Number(),
    refreshToken: t.String(),
  }),
  user: t.Object({ id: t.String(), loginName: t.String() }),
})

export const logoutResponseSchema = t.Object({ loggedOut: t.Literal(true) })

export const meResponseSchema = t.Object({
  terminal: t.Object({
    appVersion: t.Optional(t.String()),
    displayName: t.Optional(t.String()),
    platform: t.Optional(t.String()),
    terminalUuid: t.String({ format: 'uuid' }),
  }),
  user: t.Object({ id: t.String(), loginName: t.String() }),
})

export type RegisterRequest = typeof registerSchema.static
export type LoginRequest = typeof loginSchema.static
export type RefreshRequest = typeof refreshSchema.static
export type AuthTokensResponse = typeof authTokensResponseSchema.static

export const authModels = new Elysia({ name: 'dc-auth-models' }).model({
  'Auth.LoginRequest': loginSchema,
  'Auth.LogoutResponse': logoutResponseSchema,
  'Auth.MeResponse': meResponseSchema,
  'Auth.RefreshRequest': refreshSchema,
  'Auth.RegisterRequest': registerSchema,
  'Auth.TokensResponse': authTokensResponseSchema,
  'Response.AuthLogout': apiSuccessSchema(logoutResponseSchema),
  'Response.AuthMe': apiSuccessSchema(meResponseSchema),
  'Response.AuthTokens': apiSuccessSchema(authTokensResponseSchema),
})