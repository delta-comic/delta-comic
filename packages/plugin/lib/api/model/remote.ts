import type { UniResourceProcessor } from '@delta-comic/model'

export type RemoteModel = TestGroup[]

export type TestFunction = (url: string, signal: AbortSignal) => Promise<void>

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
  remotes: Definition[]
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