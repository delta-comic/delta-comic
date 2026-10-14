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
  defaultValue?: FormDefaultValue['string']
}

export interface FormNumber extends Base {
  type: 'number'
  range?: [number, number]
  float?: boolean
  defaultValue?: FormDefaultValue['number']
}

export interface FormRadio extends Base {
  type: 'radio'
  selects: { label: string; value: string }[]
  comp: 'radio' | 'select'
  defaultValue?: FormDefaultValue['radio']
}

export interface FormCheckbox extends Base {
  type: 'checkbox'
  selects: { label: string; value: string }[]
  comp: 'checkbox' | 'multipleSelect'
  defaultValue?: FormDefaultValue['checkbox']
}

export interface FormSwitch extends Base {
  type: 'switch'
  close?: string
  open?: string
  defaultValue?: FormDefaultValue['switch']
}

export interface FormDate extends Base {
  type: 'date'
  format: string
  time?: boolean
  defaultValue?: FormDefaultValue['date']
}

export interface FormDateRange extends Base {
  type: 'dateRange'
  format: string
  time?: boolean
  defaultValue?: FormDefaultValue['dateRange']
}
export interface FormPairs extends Base {
  type: 'pairs'
  defaultValue?: FormDefaultValue['pairs']
  noMultiple?: boolean
}

export interface FormDefaultValue {
  string: string
  number: number
  radio: string
  checkbox: string[]
  switch: boolean
  date: string
  pairs: { key: string; value: string }[]
  dateRange: [Form: FormDefaultValue['date'], to: FormDefaultValue['date']]
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

export type FormSingleResult<T extends FormSingleConfigure> = FormDefaultValue[T['type']]

export type FormConfigure = {
  [x in string]: FormSingleConfigure
}

export type FormResult<T extends FormConfigure> = {
  [K in keyof T]: FormSingleResult<T[K]>
}