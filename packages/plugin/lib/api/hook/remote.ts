import type { Remote } from '../model'

export interface RemoteHooks {
  onRemoteTestDone(group: Remote.TestGroup, remote: Remote.Definition | false): void
}