import { hmacSha256Hex, randomToken } from '@/shared/crypto'

export interface TokenPair {
  accessToken: string
  accessTokenHash: string
  accessExpiresAt: number
  refreshToken: string
  refreshTokenHash: string
  refreshExpiresAt: number
}

export const hashToken = async (token: string, pepper: string): Promise<string> =>
  await hmacSha256Hex(pepper, token)

export const createTokenPair = async (
  now: number,
  accessTtlSeconds: number,
  refreshTtlSeconds: number,
  pepper: string,
): Promise<TokenPair> => {
  const accessToken = randomToken()
  const refreshToken = randomToken()
  return {
    accessToken,
    accessTokenHash: await hashToken(accessToken, pepper),
    accessExpiresAt: now + accessTtlSeconds * 1000,
    refreshToken,
    refreshTokenHash: await hashToken(refreshToken, pepper),
    refreshExpiresAt: now + refreshTtlSeconds * 1000,
  }
}