export type RemoteModel = TestGroup[]

export interface TestGroup {
  name: string
  test: TestFunction
  remotes: Definition[]
}

export interface Definition {
  name: string
  url: string
  /**
   * cover root `test` method
   */
  test?: TestFunction
}

export type TestFunction = (url: string, signal: AbortSignal) => Promise<void>