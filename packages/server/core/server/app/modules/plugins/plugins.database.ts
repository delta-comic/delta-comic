import { WorkerEntrypoint } from 'cloudflare:workers'

import type { AppEnv } from '@/env'

export interface PluginDatabaseStatement {
  query: string
  values: readonly unknown[]
}

export interface PluginDatabaseBinding {
  all(query: string, values?: readonly unknown[]): Promise<D1Result>
  batch(statements: readonly PluginDatabaseStatement[]): Promise<D1Result[]>
  dump(): Promise<ArrayBuffer>
  exec(query: string): Promise<D1ExecResult>
  first(query: string, values?: readonly unknown[], columnName?: string): Promise<unknown | null>
  raw(
    query: string,
    values?: readonly unknown[],
    options?: { columnNames?: boolean },
  ): Promise<unknown[][]>
  run(query: string, values?: readonly unknown[]): Promise<D1Result>
}

/** Full-SQL RPC bridge made available to dynamically loaded plugin Workers. */
export class PluginDatabase extends WorkerEntrypoint<AppEnv> implements PluginDatabaseBinding {
  private prepare(query: string, values: readonly unknown[] = []): D1PreparedStatement {
    return this.env.DB.prepare(query).bind(...values)
  }

  async all(query: string, values: readonly unknown[] = []): Promise<D1Result> {
    return await this.prepare(query, values).all()
  }

  async batch(statements: readonly PluginDatabaseStatement[]): Promise<D1Result[]> {
    return await this.env.DB.batch(
      statements.map(({ query, values }) => this.prepare(query, values)),
    )
  }

  async dump(): Promise<ArrayBuffer> {
    return await this.env.DB.dump()
  }

  async exec(query: string): Promise<D1ExecResult> {
    return await this.env.DB.exec(query)
  }

  async first(
    query: string,
    values: readonly unknown[] = [],
    columnName?: string,
  ): Promise<unknown | null> {
    const statement = this.prepare(query, values)
    return columnName === undefined ? await statement.first() : await statement.first(columnName)
  }

  async raw(
    query: string,
    values: readonly unknown[] = [],
    options?: { columnNames?: boolean },
  ): Promise<unknown[][]> {
    if (options?.columnNames) {
      return await this.prepare(query, values).raw({ columnNames: true })
    }
    return await this.prepare(query, values).raw()
  }

  async run(query: string, values: readonly unknown[] = []): Promise<D1Result> {
    return await this.prepare(query, values).run()
  }
}