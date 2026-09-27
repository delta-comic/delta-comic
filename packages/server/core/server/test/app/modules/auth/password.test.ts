import { describe, expect, it } from 'vitest'

import { createPasswordRecord, verifyPassword } from '../../../../app/modules/auth/password'

describe('auth password helpers', () => {
  it('hashes and verifies passwords with pepper', async () => {
    const record = await createPasswordRecord('correct-password', 'pepper')

    await expect(
      verifyPassword('correct-password', record.salt, record.hash, record.alg, 'pepper'),
    ).resolves.toBe(true)
    await expect(
      verifyPassword('wrong-password', record.salt, record.hash, record.alg, 'pepper'),
    ).resolves.toBe(false)
  })
})