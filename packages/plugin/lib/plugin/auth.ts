import type { FormConfigure, FormSingleResult } from '@delta-comic/model'

export interface Config {
  signUp: (by: Method) => PromiseLike<any>
  logIn: (by: Method) => PromiseLike<any>

  passSelect: () => PromiseLike<'signUp' | 'logIn' | false>
}

export type Method = {
  form<T extends FormConfigure>(
    form: T,
  ): Promise<{
    [x in keyof T]: FormSingleResult<T[x]>
  }>
  /**
   * sandbox: "allow-forms allow-modals allow-orientation-lock allow-popups-to-escape-sandbox  allow-pointer-lock"
   */
  website(url: string): Window
}