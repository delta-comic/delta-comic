import * as Type from './row'

export type SingleConfigure =
  | Type.String
  | Type.Number
  | Type.Radio
  | Type.Checkbox
  | Type.Switch
  | Type.Date
  | Type.DateRange
  | Type.Pairs

export type SingleResult<T extends SingleConfigure> = Type.DefaultValue[T['type']]

export type Configure = {
  [x in string]: SingleConfigure
}

export type Result<T extends Configure> = {
  [K in keyof T]: SingleResult<T[K]>
}

export * as Type from './row'

export interface FormRowSlot<T extends Configure, O extends (keyof T)[], K extends O[number]> {
  config: T[K]
  path: K
  modelValue: SingleResult<T[K]>
  setModelValue(value: SingleResult<T[K]>): void
}