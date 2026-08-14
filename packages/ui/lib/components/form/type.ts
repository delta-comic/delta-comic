import type { FormConfigure, FormDefaultValue, FormSingleConfigure } from '@delta-comic/model'

export interface FormRowSlot<T extends FormConfigure, O extends (keyof T)[], K extends O[number]> {
  config: FormSingleConfigure
  path: K
  modelValue: FormDefaultValue[keyof FormDefaultValue]
  setModelValue(value: FormDefaultValue[keyof FormDefaultValue]): void
}