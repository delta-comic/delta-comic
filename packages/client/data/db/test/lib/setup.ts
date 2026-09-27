import { clearMocks } from '@tauri-apps/api/mocks'
import { afterEach, beforeEach, vi } from 'vite-plus/test'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  public get length() {
    return this.values.size
  }

  public clear() {
    this.values.clear()
  }

  public getItem(key: string) {
    return this.values.get(key) ?? null
  }

  public key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  public removeItem(key: string) {
    this.values.delete(key)
  }

  public setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const getRandomValues = <T extends ArrayBufferView | null>(buffer: T) => {
  if (buffer === null) return buffer
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  for (const [index] of bytes.entries()) bytes[index] = Math.floor(Math.random() * 256)
  return buffer
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis })
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: globalThis.crypto ?? { getRandomValues },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  })
})

afterEach(() => {
  clearMocks()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})