import type { NormalizedSyncOperation, SyncEntityRow } from './sync.types'

export const compareIncomingToCurrent = (
  incoming: Pick<NormalizedSyncOperation, 'clientChangedAt' | 'opId'> & { terminalUuid: string },
  current: Pick<SyncEntityRow, 'client_changed_at' | 'last_op_id' | 'last_terminal_uuid'>,
): number => {
  if (incoming.clientChangedAt !== current.client_changed_at) {
    return incoming.clientChangedAt > current.client_changed_at ? 1 : -1
  }
  if (incoming.terminalUuid !== current.last_terminal_uuid) {
    return incoming.terminalUuid > current.last_terminal_uuid ? 1 : -1
  }
  if (incoming.opId === current.last_op_id) return 0
  return incoming.opId > current.last_op_id ? 1 : -1
}

export const shouldApplyOperation = (
  incoming: NormalizedSyncOperation & { terminalUuid: string },
  current: SyncEntityRow | null,
): boolean => {
  if (!current) return true
  const incomingDeleted = incoming.action === 'delete'
  const currentDeleted = current.deleted_at !== null
  if (incoming.dataHash === current.data_hash && incomingDeleted === currentDeleted) return false
  return compareIncomingToCurrent(incoming, current) > 0
}