import type { TSchema } from '@sinclair/typebox'
import { t } from 'elysia'

import { AppError, asPublicError } from './errors'

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export const apiFailureSchema = t.Object({
  error: t.Object({ code: t.String(), details: t.Optional(t.Any()), message: t.String() }),
  ok: t.Literal(false),
})

export const apiSuccessSchema = <Data extends TSchema>(data: Data) =>
  t.Object({ data, ok: t.Literal(true) })

export const ok = <const T>(data: T): ApiSuccess<T> => ({ ok: true, data })

export const fail = (error: AppError): ApiFailure => ({
  ok: false,
  error: {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  },
})

const maybeValidationError = (error: unknown): AppError | undefined => {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { code?: unknown; message?: unknown }
  if (candidate.code === 'VALIDATION') {
    return new AppError(
      'REQUEST_VALIDATION_FAILED',
      String(candidate.message ?? 'request validation failed'),
      400,
    )
  }
  return undefined
}

const maybeFrameworkError = (
  error: unknown,
  code: string | number | undefined,
): AppError | undefined => {
  if (code === 'NOT_FOUND') return new AppError('ROUTE_NOT_FOUND', 'route not found', 404)
  if (code === 'VALIDATION') return maybeValidationError(error)
  return undefined
}

export const errorResponse = (error: unknown, code?: string | number): Response => {
  const publicError =
    maybeFrameworkError(error, code) ?? maybeValidationError(error) ?? asPublicError(error)
  return Response.json(fail(publicError), { status: publicError.status })
}