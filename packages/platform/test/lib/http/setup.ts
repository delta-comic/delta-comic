import { clearMocks } from '@tauri-apps/api/mocks'
import { afterEach, beforeAll, vi } from 'vite-plus/test'

const nativeFetch = globalThis.fetch
const NativeXMLHttpRequest = class NativeXMLHttpRequest {}
let cryptoByte = 1

function fillRandomValues<T extends ArrayBufferView | null>(buffer: T): T {
  if (!buffer) return buffer

  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = cryptoByte
    cryptoByte = (cryptoByte + 1) % 256
  }

  return buffer
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })

  Object.defineProperty(globalThis, 'location', {
    value: new URL('http://localhost/'),
    configurable: true,
  })

  if (!globalThis.crypto?.getRandomValues) {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: fillRandomValues },
      configurable: true,
    })
  }

  Object.defineProperty(globalThis, 'XMLHttpRequest', {
    value: NativeXMLHttpRequest,
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  clearMocks()
  vi.restoreAllMocks()

  Reflect.deleteProperty(window, 'CORSFetch')
  Reflect.deleteProperty(window, 'fetchCORS')
  Reflect.deleteProperty(window, 'fetchNative')
  Reflect.deleteProperty(window, 'XMLHttpRequestNative')

  window.fetch = nativeFetch
  window.XMLHttpRequest = NativeXMLHttpRequest as typeof XMLHttpRequest
})