import { bytesToBase64Url, constantTimeEqual, randomBytes } from '@/shared/crypto'

const textEncoder = new TextEncoder()
const PBKDF2_ITERATIONS = 210_000
const PASSWORD_ALG = `pbkdf2-sha256:${PBKDF2_ITERATIONS}`

const derivePasswordHash = async (
  password: string,
  salt: string,
  pepper: string,
): Promise<string> => {
  const sourceKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(`${pepper}:${password}`),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      name: 'PBKDF2',
      salt: textEncoder.encode(salt),
    },
    sourceKey,
    256,
  )
  return bytesToBase64Url(new Uint8Array(bits))
}

export const createPasswordRecord = async (password: string, pepper: string) => {
  const salt = bytesToBase64Url(randomBytes(16))
  return { alg: PASSWORD_ALG, hash: await derivePasswordHash(password, salt, pepper), salt }
}

export const verifyPassword = async (
  password: string,
  salt: string,
  expectedHash: string,
  alg: string,
  pepper: string,
): Promise<boolean> => {
  if (alg !== PASSWORD_ALG) return false
  const actualHash = await derivePasswordHash(password, salt, pepper)
  return constantTimeEqual(actualHash, expectedHash)
}