import type { UniResourceProcessor } from '@delta-comic/model'

export type RemoteModel = TestGroup[]

export type TestFunction = (url: string, signal: AbortSignal) => Promise<void>

export type RemoteListProvider = (signal: AbortSignal) => Promise<Definition[]>

export type RemoteSource = Definition | RemoteListProvider

export interface Definition {
  name: string
  url: string
  /**
   * cover root `test` method
   */
  test?: TestFunction
}

export interface TestGroupBase {
  name: string
  remotes: RemoteSource[] | RemoteListProvider
  /**
   * group-level default test
   */
  test: TestFunction
  allowNoConnected?: boolean
}

export interface TestRemoteGroup extends TestGroupBase {
  type: 'remote'
}

export interface TestResourceGroup extends TestGroupBase {
  type: 'resource'
  processors?: UniResourceProcessor[]
}

export type TestGroup = TestRemoteGroup | TestResourceGroup

export interface ResolvedTestGroupBase extends Omit<TestGroupBase, 'remotes'> {
  remotes: Definition[]
}

export interface ResolvedTestRemoteGroup extends ResolvedTestGroupBase {
  type: 'remote'
}

export interface ResolvedTestResourceGroup extends ResolvedTestGroupBase {
  type: 'resource'
  processors?: UniResourceProcessor[]
}

export type ResolvedTestGroup = ResolvedTestRemoteGroup | ResolvedTestResourceGroup