import type {
  SyncAction,
  SyncChange,
  SyncOperationResult,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItemResult,
  SyncPushOperation,
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshotRequest,
} from './sync/types'

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export interface CloudHealthResponse {
  service: 'delta-comic-server'
  status: 'ok'
}

export type MaybePromise<T> = T | Promise<T>

export interface CloudTerminalInput {
  appVersion?: string
  platform?: string
  terminalName?: string
  terminalUuid: string
}

export type CloudTerminalProvider = CloudTerminalInput | (() => MaybePromise<CloudTerminalInput>)

export interface CloudAuthTokens {
  accessExpiresAt: number
  accessToken: string
  refreshExpiresAt: number
  refreshToken: string
}

export interface CloudUser {
  id: string
  loginName: string
}

export interface CloudSessionTerminal {
  displayName?: string
  terminalUuid: string
}

export interface CloudSession {
  terminal: CloudSessionTerminal
  tokens: CloudAuthTokens
  user: CloudUser
}

export type CloudLoginRequest = CloudTerminalInput & { loginName: string; password: string }
export type CloudRegisterRequest = CloudLoginRequest
export interface CloudRefreshRequest {
  refreshToken: string
}

export type CloudLoginInput = Pick<CloudLoginRequest, 'loginName' | 'password'> &
  Partial<CloudTerminalInput>
export type CloudRegisterInput = Pick<CloudRegisterRequest, 'loginName' | 'password'> &
  Partial<CloudTerminalInput>

export type {
  SyncAction,
  SyncChange,
  SyncOperationResult,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushItemResult,
  SyncPushOperation,
  SyncPushRequest,
  SyncPushResponse,
  SyncSnapshotRequest,
}