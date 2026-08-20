import type { Remote } from '../model'

export interface RemoteHooks {
  onRemoteTestDone(group: Remote.ResolvedTestRemoteGroup, remote: Remote.Definition | false): void
}