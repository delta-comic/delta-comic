import { describe, expect, it } from 'vitest'

import { createCloudClient } from '../../lib/client'
import { CloudApiError, CloudDisabledError } from '../../lib/errors'
import { MemoryCloudSessionStorage } from '../../lib/storage'
import { getSyncEntityId } from '../../lib/sync/collections'
import { createSyncOperation, createSyncSnapshotRequest } from '../../lib/sync/operations'
import type { CloudSession } from '../../lib/types'

const session = (): CloudSession => ({
  terminal: { terminalUuid: '00000000-0000-4000-8000-000000000000' },
  tokens: {
    accessExpiresAt: Date.now() + 120_000,
    accessToken: 'access-token',
    refreshExpiresAt: Date.now() + 240_000,
    refreshToken: 'refresh-token',
  },
  user: { id: 'user-id', loginName: 'alice' },
})

const jsonResponse = (data: unknown, init?: ResponseInit): Response => Response.json(data, init)

describe('DeltaComicCloudClient', () => {
  it('does not perform requests when cloud is disabled', async () => {
    let called = false
    const client = createCloudClient({
      baseUrl: 'https://cloud.example',
      enabled: false,
      fetcher: async () => {
        called = true
        return jsonResponse({ ok: true, data: {} })
      },
    })

    await expect(client.health()).rejects.toBeInstanceOf(CloudDisabledError)
    expect(called).toBe(false)
  })

  it('injects bearer token into authenticated ky requests', async () => {
    const storage = new MemoryCloudSessionStorage()
    await storage.setSession(session())
    const client = createCloudClient({
      baseUrl: 'https://cloud.example',
      fetcher: async input => {
        const request = input instanceof Request ? input : new Request(input)
        expect(request.url).toBe('https://cloud.example/api/auth/me')
        expect(request.headers.get('authorization')).toBe('Bearer access-token')
        return jsonResponse({
          data: {
            terminal: { terminalUuid: '00000000-0000-4000-8000-000000000000' },
            user: { id: 'user-id', loginName: 'alice' },
          },
          ok: true,
        })
      },
      sessionStorage: storage,
    })

    await expect(client.auth.me()).resolves.toMatchObject({ user: { loginName: 'alice' } })
  })

  it('maps unified API failures to CloudApiError', async () => {
    const client = createCloudClient({
      baseUrl: 'https://cloud.example',
      fetcher: async () =>
        jsonResponse(
          { error: { code: 'AUTH_MISSING_TOKEN', message: 'missing token' }, ok: false },
          { status: 401 },
        ),
    })

    await expect(client.health()).rejects.toMatchObject({
      code: 'AUTH_MISSING_TOKEN',
      status: 401,
    } satisfies Partial<CloudApiError>)
  })

  it('builds sync entity ids and snapshot operations compatible with the server', async () => {
    expect(getSyncEntityId('favouriteItem', { belongTo: 1, itemKey: 'comic:1' })).toBe('1:comic:1')
    expect(getSyncEntityId('subscribe', { key: 'author', plugin: 'demo' })).toBe('demo:author')

    const operation = await createSyncOperation({
      action: 'upsert',
      clientChangedAt: 1,
      collection: 'config',
      data: { belongTo: 'core', data: '{}', form: '{}' },
      opId: 'op-id',
    })
    expect(operation).toMatchObject({
      action: 'upsert',
      collection: 'config',
      entityId: 'core',
      opId: 'op-id',
    })

    expect(createSyncSnapshotRequest({ config: [] }, 'snapshot-id')).toEqual({
      collections: { config: [] },
      schemaVersion: 1,
      snapshotId: 'snapshot-id',
    })
  })
})