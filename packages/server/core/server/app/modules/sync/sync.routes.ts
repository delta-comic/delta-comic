import Elysia from 'elysia'

import { authGuard } from '@/shared/http/authGuard'
import { ok } from '@/shared/response'

import { syncModels } from './sync.schemas'

export const syncRoutes = new Elysia({ prefix: '/sync' })
  .use(syncModels)
  .use(authGuard)
  .post(
    '/snapshot',
    async ({ auth, body, syncService }) => ok(await syncService.snapshot(auth, body)),
    {
      body: 'Sync.SnapshotRequest',
      detail: { summary: 'Push a full local snapshot as sync operations', tags: ['Sync'] },
      response: { 200: 'Response.SyncPush' },
    },
  )
  .post('/push', async ({ auth, body, syncService }) => ok(await syncService.push(auth, body)), {
    body: 'Sync.PushRequest',
    detail: { summary: 'Push incremental sync operations', tags: ['Sync'] },
    response: { 200: 'Response.SyncPush' },
  })
  .post('/pull', async ({ auth, body, syncService }) => ok(await syncService.pull(auth, body)), {
    body: 'Sync.PullRequest',
    detail: { summary: 'Pull remote sync changes after a checkpoint', tags: ['Sync'] },
    response: { 200: 'Response.SyncPull' },
  })