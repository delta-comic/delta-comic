import Elysia from 'elysia'

import { serverContext } from '@/infrastructure/http/serverContext'
import { authGuard } from '@/shared/http/authGuard'
import { ok } from '@/shared/response'

import { authModels } from './auth.schemas'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(serverContext)
  .use(authModels)
  .post('/register', async ({ authService, body }) => ok(await authService.register(body)), {
    body: 'Auth.RegisterRequest',
    detail: { summary: 'Register and create a terminal session', tags: ['Auth'] },
    response: { 200: 'Response.AuthTokens' },
  })
  .post('/login', async ({ authService, body }) => ok(await authService.login(body)), {
    body: 'Auth.LoginRequest',
    detail: { summary: 'Login and create a terminal session', tags: ['Auth'] },
    response: { 200: 'Response.AuthTokens' },
  })
  .post(
    '/refresh',
    async ({ authService, body }) => ok(await authService.refresh(body.refreshToken)),
    {
      body: 'Auth.RefreshRequest',
      detail: { summary: 'Rotate an active refresh token', tags: ['Auth'] },
      response: { 200: 'Response.AuthTokens' },
    },
  )
  .use(authGuard)
  .post('/logout', async ({ auth, authService }) => ok(await authService.logout(auth)), {
    detail: { summary: 'Logout current session', tags: ['Auth'] },
    response: { 200: 'Response.AuthLogout' },
  })
  .get('/me', async ({ auth, authService }) => ok(await authService.me(auth)), {
    detail: { summary: 'Get current user and terminal', tags: ['Auth'] },
    response: { 200: 'Response.AuthMe' },
  })