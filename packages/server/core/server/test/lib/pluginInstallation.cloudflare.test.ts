import { describe, expect, it } from 'vitest'

import { CloudflareD1InstallationDatabase } from '../../lib/index'

describe('Cloudflare D1 installation provisioning', () => {
  it('creates a per-installation D1 database through the Cloudflare API', async () => {
    const requests: Request[] = []
    const database = new CloudflareD1InstallationDatabase({
      accountId: 'account',
      apiToken: 'token',
      fetcher: async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        return request.method === 'DELETE'
          ? Response.json({ success: true })
          : Response.json({ result: { name: 'isolated-db', uuid: 'db-1' }, success: true })
      },
    })

    await expect(database.create('demo', 'installation-1')).resolves.toEqual({
      databaseId: 'db-1',
      name: 'isolated-db',
    })
    expect(requests[0]?.url).toContain('/accounts/account/d1/database')
    expect(requests[0]?.method).toBe('POST')
    await expect(database.remove('demo', 'installation-1', 'db-1')).resolves.toBeUndefined()
    expect(requests[1]?.url).toContain('/accounts/account/d1/database/db-1')
    expect(requests[1]?.method).toBe('DELETE')
  })
})