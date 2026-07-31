export interface Config {
  forks: () => PromiseLike<string[]> | string[]
  /**
   * error -> 不可用
   * other -> 可用并比对时间
   */
  test: (fork: string, signal: AbortSignal) => PromiseLike<void>
}