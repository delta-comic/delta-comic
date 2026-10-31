import { describe, expect, it, vi } from 'vitest'

import type { CloudHttpClient } from '../../../lib/http'
import { CloudSyncClient } from '../../../lib/sync/client'

describe('CloudSyncClient', () => {
  it('validates access before snapshot, push, and pull and pins the protocol schema', async () => {
    const http = { post: vi.fn(async () => ({ checkpoint: { latestSeq: 0 }, results: [] })) }
    const ensureAccessToken = vi.fn(async () => 'access')
    const sync = new CloudSyncClient(http as unknown as CloudHttpClient, ensureAccessToken)

    await sync.snapshot({ collections: { config: [] }, schemaVersion: 1, snapshotId: 'snapshot-1' })
    await sync.push({ operations: [], schemaVersion: 99 as 1 })
    await sync.pull({ schemaVersion: 99 as 1, sinceSeq: 4 })
    await sync.pull({ sinceSeq: 5 })

    expect(ensureAccessToken).toHaveBeenCalledTimes(4)
    expect(http.post).toHaveBeenNthCalledWith(1, 'sync/snapshot', {
      collections: { config: [] },
      schemaVersion: 1,
      snapshotId: 'snapshot-1',
    })
    expect(http.post).toHaveBeenNthCalledWith(2, 'sync/push', { operations: [], schemaVersion: 1 })
    expect(http.post).toHaveBeenNthCalledWith(3, 'sync/pull', { schemaVersion: 99, sinceSeq: 4 })
    expect(http.post).toHaveBeenNthCalledWith(4, 'sync/pull', { schemaVersion: 1, sinceSeq: 5 })
  })

  it('does not send a request when access validation fails', async () => {
    const http = { post: vi.fn() }
    const sync = new CloudSyncClient(http as unknown as CloudHttpClient, async () => {
      throw new Error('expired')
    })

    await expect(sync.push({ operations: [], schemaVersion: 1 })).rejects.toThrow('expired')
    expect(http.post).not.toHaveBeenCalled()
  })
})