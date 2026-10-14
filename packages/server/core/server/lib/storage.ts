import type { CloudSession } from './types'

export interface CloudSessionStorage {
  clearSession(): Promise<void>
  getSession(): Promise<CloudSession | null>
  setSession(session: CloudSession): Promise<void>
}

interface StringStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

export class MemoryCloudSessionStorage implements CloudSessionStorage {
  private session: CloudSession | null = null

  async clearSession(): Promise<void> {
    this.session = null
  }

  async getSession(): Promise<CloudSession | null> {
    return this.session
  }

  async setSession(session: CloudSession): Promise<void> {
    this.session = session
  }
}

export class LocalStorageCloudSessionStorage implements CloudSessionStorage {
  constructor(
    private readonly key = 'delta-comic:cloud:session',
    private readonly storage: StringStorage | undefined = (
      globalThis as { localStorage?: StringStorage }
    ).localStorage,
  ) {}

  async clearSession(): Promise<void> {
    this.storage?.removeItem(this.key)
  }

  async getSession(): Promise<CloudSession | null> {
    const raw = this.storage?.getItem(this.key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as CloudSession
    } catch {
      await this.clearSession()
      return null
    }
  }

  async setSession(session: CloudSession): Promise<void> {
    this.storage?.setItem(this.key, JSON.stringify(session))
  }
}