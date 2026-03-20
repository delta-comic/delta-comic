export interface Config {
  call: (setDescription: (description: string) => void) => PromiseLike<any>
  name: string
}