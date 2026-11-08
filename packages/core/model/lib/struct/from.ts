export interface Base {
  info: string
  placeholder?: string
  /**
   * @default true
   */
  required?: boolean
}

export interface FormString extends Base {
  type: 'string'
  patten?: RegExp
  defaultValue?: string
}

export interface FormNumber extends Base {
  type: 'number'
  range?: [number, number]
  float?: boolean
  defaultValue?: number
}

export interface FormRadio extends Base {
  type: 'radio'
  selects: { label: string; value: string }[]
  comp: 'radio' | 'select'
  defaultValue?: string
}

export interface FormCheckbox extends Base {
  type: 'checkbox'
  selects: { label: string; value: string }[]
  comp: 'checkbox' | 'multipleSelect'
  defaultValue?: string[]
}

export interface FormSwitch extends Base {
  type: 'switch'
  close?: string
  open?: string
  defaultValue?: boolean
}

export interface FormDate extends Base {
  type: 'date'
  format: string
  time?: boolean
  defaultValue?: string
}

export interface FormDateRange extends Base {
  type: 'dateRange'
  format: string
  time?: boolean
  defaultValue?: [string, string]
}
export interface FormPairs extends Base {
  type: 'pairs'
  defaultValue?: { key: string; value: string }[]
  noMultiple?: boolean
}

export type FormSingleConfigure =
  | FormString
  | FormNumber
  | FormRadio
  | FormCheckbox
  | FormSwitch
  | FormDate
  | FormDateRange
  | FormPairs

export type FormSingleResult<T extends FormSingleConfigure> = T extends { defaultValue?: infer V }
  ? V
  : never

export type FormDefaultValue = {
  [T in FormSingleConfigure as T['type']]: FormSingleResult<T>
}

export type FormTypeToConfigure = {
  [T in FormSingleConfigure as T['type']]: T
}

export type FormConfigure = {
  [x in string]: FormSingleConfigure
}

export type FormResult<T extends FormConfigure> = {
  [K in keyof T]: FormSingleResult<T[K]>
}