export interface Config {
  /** Run immediately with adjacent async steps; a trailing async group does not block loading. */
  async?: boolean
  call: (setDescription: (description: string) => void) => PromiseLike<any>
  name: string
}