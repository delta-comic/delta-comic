import type { FormConfigure, FormSingleResult } from '@delta-comic/client-core-model'

export interface FormRowSlot<T extends FormConfigure, O extends (keyof T)[], K extends O[number]> {
  config: T[K]
  path: K
  modelValue: FormSingleResult<T[K]>
  setModelValue(value: FormSingleResult<T[K]>): void
}