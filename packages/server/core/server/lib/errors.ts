import type { ApiFailure, ApiResponse } from './types'

export class CloudClientError extends Error {
  readonly code: string
  readonly details?: unknown
  readonly status?: number

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'CloudClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class CloudApiError extends CloudClientError {
  constructor(error: ApiFailure['error'], status?: number) {
    super(error.code, error.message, status, error.details)
    this.name = 'CloudApiError'
  }
}

export class CloudDisabledError extends CloudClientError {
  constructor(message = 'cloud service is disabled') {
    super('CLOUD_DISABLED', message)
    this.name = 'CloudDisabledError'
  }
}

export class CloudConfigurationError extends CloudClientError {
  constructor(message: string, details?: unknown) {
    super('CLOUD_CONFIGURATION_ERROR', message, undefined, details)
    this.name = 'CloudConfigurationError'
  }
}

export class CloudUnauthenticatedError extends CloudClientError {
  constructor(message = 'cloud session is missing or expired') {
    super('CLOUD_UNAUTHENTICATED', message, 401)
    this.name = 'CloudUnauthenticatedError'
  }
}

export const unwrapApiResponse = <T>(response: ApiResponse<T>, status?: number): T => {
  if (response.ok) return response.data
  throw new CloudApiError(response.error, status)
}

export const toCloudClientError = (error: unknown): CloudClientError => {
  if (error instanceof CloudClientError) return error
  if (error instanceof Error) return new CloudClientError('CLOUD_REQUEST_FAILED', error.message)
  return new CloudClientError('CLOUD_REQUEST_FAILED', 'cloud request failed', undefined, error)
}