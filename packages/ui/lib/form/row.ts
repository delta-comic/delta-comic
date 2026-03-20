export interface Base {
  info: string
  placeholder?: string
  /**
   * @default true
   */
  required?: boolean
}

export interface String extends Base {
  type: 'string'
  patten?: RegExp
  defaultValue?: DefaultValue['string']
}

export interface Number extends Base {
  type: 'number'
  range?: [number, number]
  float?: boolean
  defaultValue?: DefaultValue['number']
}

export interface Radio extends Base {
  type: 'radio'
  selects: { label: string; value: string }[]
  comp: 'radio' | 'select'
  defaultValue?: DefaultValue['radio']
}

export interface Checkbox extends Base {
  type: 'checkbox'
  selects: { label: string; value: string }[]
  comp: 'checkbox' | 'multipleSelect'
  defaultValue?: DefaultValue['checkbox']
}

export interface Switch extends Base {
  type: 'switch'
  close?: string
  open?: string
  defaultValue?: DefaultValue['switch']
}

export interface Date extends Base {
  type: 'date'
  format: string
  time?: boolean
  defaultValue?: DefaultValue['date']
}

export interface DateRange extends Base {
  type: 'dateRange'
  format: string
  time?: boolean
  defaultValue?: DefaultValue['dateRange']
}
export interface Pairs extends Base {
  type: 'pairs'
  defaultValue?: DefaultValue['pairs']
  noMultiple?: boolean
}

export interface DefaultValue {
  string: string
  number: number
  radio: string
  checkbox: string[]
  switch: boolean
  date: string
  pairs: { key: string; value: string }[]
  dateRange: [from: DefaultValue['date'], to: DefaultValue['date']]
}