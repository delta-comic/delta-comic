import { logger } from '@delta-comic/logger'
import type { CloudSession, CloudSessionStorage, CloudTerminalInput } from '@delta-comic/server'

const cloudStorageLogger = logger.scoped('app:cloud:storage')
const namespace = 'cloud'
const sessionKey = 'session'
const checkpointKey = 'sync-checkpoint'
const terminalUuidKey = 'terminal-uuid'

const readValue = async (key: string): Promise<string | null> => {
  const { db } = await import('@delta-comic/db')
  return (
    (
      await db
        .selectFrom('nativeStore')
        .select('value')
        .where('namespace', '=', namespace)
        .where('key', '=', key)
        .executeTakeFirst()
    )?.value ?? null
  )
}

const writeValue = async (key: string, value: string): Promise<void> => {
  const { db } = await import('@delta-comic/db')
  await db.replaceInto('nativeStore').values({ key, namespace, value }).execute()
}

const removeValue = async (key: string): Promise<void> => {
  const { db } = await import('@delta-comic/db')
  await db
    .deleteFrom('nativeStore')
    .where('namespace', '=', namespace)
    .where('key', '=', key)
    .execute()
}

const parseJson = <T>(value: string | null): T | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch (error) {
    cloudStorageLogger.warn('failed to parse cloud storage value', error)
    return null
  }
}

const randomUuid = (): string => {
  const cryptoWithUuid = crypto as Crypto & { randomUUID?: () => string }
  if (typeof cryptoWithUuid.randomUUID === 'function') return cryptoWithUuid.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const value = (Math.random() * 16) | 0
    const resolved = char === 'x' ? value : (value & 0x3) | 0x8
    return resolved.toString(16)
  })
}

export class DbCloudSessionStorage implements CloudSessionStorage {
  async clearSession(): Promise<void> {
    await removeValue(sessionKey)
    cloudStorageLogger.info('cloud session removed')
  }

  async getSession(): Promise<CloudSession | null> {
    const session = parseJson<CloudSession>(await readValue(sessionKey))
    cloudStorageLogger.debug('cloud session loaded', { found: Boolean(session) })
    return session
  }

  async setSession(session: CloudSession): Promise<void> {
    await writeValue(sessionKey, JSON.stringify(session))
    cloudStorageLogger.info('cloud session persisted')
  }
}

export class DbCloudSyncStorage {
  async getCheckpoint(): Promise<number> {
    const checkpoint = parseJson<{ latestSeq: number }>(await readValue(checkpointKey))
    return checkpoint?.latestSeq ?? 0
  }

  async setCheckpoint(latestSeq: number): Promise<void> {
    await writeValue(checkpointKey, JSON.stringify({ latestSeq }))
    cloudStorageLogger.debug('sync checkpoint persisted', { latestSeq })
  }
}

export const getCloudTerminal = async (): Promise<CloudTerminalInput> => {
  const stored = parseJson<{ terminalUuid: string }>(await readValue(terminalUuidKey))
  const terminalUuid = stored?.terminalUuid ?? randomUuid()
  if (!stored) {
    await writeValue(terminalUuidKey, JSON.stringify({ terminalUuid }))
    cloudStorageLogger.info('cloud terminal identity created')
  }
  const navigatorInfo = globalThis.navigator
  return {
    platform: navigatorInfo?.platform || 'unknown',
    terminalName: (navigatorInfo?.userAgent || 'Delta Comic').slice(0, 128),
    terminalUuid,
  }
}