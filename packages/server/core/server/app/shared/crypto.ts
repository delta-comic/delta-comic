import { stableStringify } from './json'

const textEncoder = new TextEncoder()

export const bytesToBase64Url = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export const randomToken = (): string => bytesToBase64Url(randomBytes(32))

export const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input))
  return bytesToHex(new Uint8Array(digest))
}

export const hashJson = async (value: unknown): Promise<string> => sha256Hex(stableStringify(value))

export const hmacSha256Hex = async (secret: string, input: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(input))
  return bytesToHex(new Uint8Array(signature))
}

export const constantTimeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}