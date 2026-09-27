import { describe, expect, it } from 'vitest'

import { createTokenPair, hashToken } from '../../../../app/modules/auth/token'

describe('auth token helpers', () => {
  it('creates hash-only token metadata', async () => {
    const tokens = await createTokenPair(1000, 10, 20, 'pepper')

    expect(tokens.accessToken).not.toBe(tokens.accessTokenHash)
    expect(tokens.refreshToken).not.toBe(tokens.refreshTokenHash)
    expect(tokens.accessExpiresAt).toBe(11_000)
    expect(tokens.refreshExpiresAt).toBe(21_000)
    await expect(hashToken(tokens.accessToken, 'pepper')).resolves.toBe(tokens.accessTokenHash)
  })
})