import { bearer } from '@elysiajs/bearer'
import Elysia from 'elysia'

import { getRuntime } from '@/env'
import { AppError } from '@/shared/errors'

const textEncoder = new TextEncoder()

const digestToken = async (token: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(token)))

const fixedLengthFallback = (left: Uint8Array, right: Uint8Array): boolean => {
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index]
  return difference === 0
}

export const constantTimeTokenEqual = async (
  provided: string,
  expected: string,
): Promise<boolean> => {
  const [providedDigest, expectedDigest] = await Promise.all([
    digestToken(provided),
    digestToken(expected),
  ])

  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(providedDigest, expectedDigest)
  }
  return fixedLengthFallback(providedDigest, expectedDigest)
}

export const assertAdminBearerToken = async (
  expected: string | undefined,
  provided: string | undefined,
): Promise<void> => {
  if (!expected?.trim()) {
    throw new AppError('ADMIN_TOKEN_NOT_CONFIGURED', 'SERVER_ADMIN_TOKEN is not configured', 503)
  }
  if (!provided || !(await constantTimeTokenEqual(provided, expected))) {
    throw new AppError('ADMIN_UNAUTHORIZED', 'valid administrator Bearer token is required', 401)
  }
}

export const adminGuard = new Elysia({ name: 'dc-admin-guard' })
  .use(bearer())
  .guard({ detail: { security: [{ adminBearerAuth: [] }] } })
  .resolve(async ({ bearer: token, request, set }) => {
    const { env } = getRuntime(request)
    try {
      await assertAdminBearerToken(env.SERVER_ADMIN_TOKEN, token)
    } catch (error) {
      if (error instanceof AppError && error.status === 401) {
        set.headers['www-authenticate'] = 'Bearer realm="delta-comic-admin"'
      }
      throw error
    }
    return { admin: { authenticated: true as const } }
  })
  .as('scoped')