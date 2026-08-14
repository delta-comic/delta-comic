import type { Remote } from '../model'

export interface RemoteHooks {
  onRemoteTestDone(group: Remote.TestRemoteGroup, remote: Remote.Definition | false): void
}