export interface PluginInstallationDatabase {
  create(pluginId: string, installationId: string): Promise<PluginInstallationDatabaseHandle>
  remove(pluginId: string, installationId: string, databaseId: string): Promise<void>
}

export interface PluginInstallationDatabaseHandle {
  databaseId: string
  name?: string
}

export interface PluginInstallationRecord {
  pluginId: string
  installationId: string
  database: PluginInstallationDatabaseHandle
}

export interface CloudflareD1InstallationDatabaseOptions {
  accountId: string
  apiToken: string
  databaseName?: (pluginId: string, installationId: string) => string
  fetcher?: typeof fetch
  jurisdiction?: string
}

interface CloudflareD1Response {
  result?: { name?: string; uuid?: string }
  success?: boolean
  errors?: readonly { message?: string }[]
}

export class CloudflareD1InstallationDatabase implements PluginInstallationDatabase {
  readonly #fetcher: typeof fetch

  public constructor(private readonly options: CloudflareD1InstallationDatabaseOptions) {
    this.#fetcher = (options.fetcher ?? globalThis.fetch).bind(globalThis)
  }

  public async create(
    pluginId: string,
    installationId: string,
  ): Promise<{ databaseId: string; name: string }> {
    const name =
      this.options.databaseName?.(pluginId, installationId) ??
      `delta-comic-${pluginId}-${installationId}`
    const response = await this.#fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.options.accountId)}/d1/database`,
      {
        body: JSON.stringify({
          ...(this.options.jurisdiction ? { jurisdiction: this.options.jurisdiction } : {}),
          name,
        }),
        headers: {
          'authorization': `Bearer ${this.options.apiToken}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    )
    const payload = (await response.json()) as CloudflareD1Response
    if (!response.ok || !payload.success || !payload.result?.uuid) {
      throw new Error(
        payload.errors?.[0]?.message ?? `D1 database creation failed: ${response.status}`,
      )
    }
    return { databaseId: payload.result.uuid, name: payload.result.name ?? name }
  }

  public async remove(
    _pluginId: string,
    installationId: string,
    databaseId: string,
  ): Promise<void> {
    if (!installationId.trim()) throw new TypeError('installationId is required')
    if (!databaseId.trim()) throw new TypeError('databaseId is required')
    const response = await this.#fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.options.accountId)}/d1/database/${encodeURIComponent(databaseId)}`,
      { headers: { authorization: `Bearer ${this.options.apiToken}` }, method: 'DELETE' },
    )
    const payload = (await response.json()) as CloudflareD1Response
    if (!response.ok || !payload.success) {
      throw new Error(
        payload.errors?.[0]?.message ?? `D1 database removal failed: ${response.status}`,
      )
    }
  }
}

export class PluginInstallationManager {
  readonly #records = new Map<string, PluginInstallationRecord>()

  public constructor(private readonly database: PluginInstallationDatabase) {}

  public async ensure(pluginId: string, installationId: string): Promise<PluginInstallationRecord> {
    const key = `${pluginId}:${installationId}`
    const existing = this.#records.get(key)
    if (existing) return existing
    const record = {
      database: await this.database.create(pluginId, installationId),
      installationId,
      pluginId,
    }
    this.#records.set(key, record)
    return record
  }

  public async remove(pluginId: string, installationId: string): Promise<void> {
    const key = `${pluginId}:${installationId}`
    const existing = this.#records.get(key)
    if (!existing) return
    await this.database.remove(pluginId, installationId, existing.database.databaseId)
    this.#records.delete(key)
  }

  public list(): readonly PluginInstallationRecord[] {
    return [...this.#records.values()]
  }
}

export class UnavailablePluginInstallationDatabase implements PluginInstallationDatabase {
  public async create(_pluginId: string, _installationId: string): Promise<never> {
    throw new Error('per-installation D1 provisioning is unavailable')
  }

  public async remove(
    _pluginId: string,
    _installationId: string,
    _databaseId: string,
  ): Promise<void> {
    throw new Error('per-installation D1 provisioning is unavailable')
  }
}