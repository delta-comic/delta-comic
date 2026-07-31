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
   * @param injectCode 你可以在js调用`callback(...)`来完成鉴权，传值为你给的回调
   */
  website<T>(url: string, injectCode: InjectCode): Promise<CallbackResult<T>>
}

export interface InjectCode {
  js: string
  css: string
}

export interface CallbackResult<T> {
  callbackValue: T
  cookie: string
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  href: string
  title: string
}