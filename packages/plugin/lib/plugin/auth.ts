import type { FormType } from '@delta-comic/ui'

export interface Config {
  signUp: (by: Method) => PromiseLike<any>
  logIn: (by: Method) => PromiseLike<any>

  passSelect: () => PromiseLike<'signUp' | 'logIn' | false>
}

export type Method = {
  form<T extends FormType.Configure>(
    form: T
  ): Promise<{
    [x in keyof T]: FormType.SingleResult<T[x]>
  }>
  /**
   * sandbox: "allow-forms allow-modals allow-orientation-lock allow-popups-to-escape-sandbox  allow-pointer-lock"
   */
  website(url: string): Window
}