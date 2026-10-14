import type {
  AuthTokensResponse,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
} from './auth.schemas'

export type { AuthTokensResponse, LoginRequest, RefreshRequest, RegisterRequest }

export interface AuthUserRow {
  id: string
  login_name: string
  password_hash: string
  password_salt: string
  password_alg: string
  created_at: number
  updated_at: number
  disabled_at: number | null
}

export interface AuthTerminalRow {
  user_id: string
  terminal_uuid: string
  display_name: string | null
  platform: string | null
  app_version: string | null
  created_at: number
  last_seen_at: number
  revoked_at: number | null
}

export interface AuthSessionRow {
  id: string
  user_id: string
  terminal_uuid: string
  access_token_hash: string
  refresh_token_hash: string
  created_at: number
  access_expires_at: number
  refresh_expires_at: number
  rotated_at: number | null
  revoked_at: number | null
}

interface TerminalInput {
  terminalUuid: string
  terminalName?: string
  platform?: string
  appVersion?: string
}

export type TerminalRequestInput = TerminalInput

export interface AuthContext {
  userId: string
  loginName: string
  terminalUuid: string
  sessionId: string
}