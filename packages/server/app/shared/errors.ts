import { logger } from '@delta-comic/logger'

const errorLogger = logger.scoped('server:error')

export type ErrorDetails = Record<string, unknown> | unknown[] | string | number | boolean | null

export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: ErrorDetails

  constructor(code: string, message: string, status = 500, details?: ErrorDetails) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError

export const asPublicError = (error: unknown): AppError => {
  if (isAppError(error)) return error
  errorLogger.error('unhandled error', error)
  return new AppError('INTERNAL_ERROR', 'internal server error', 500)
}