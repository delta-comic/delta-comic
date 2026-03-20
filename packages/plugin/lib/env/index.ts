import { type Component, type Raw } from 'vue'

import Inject from './Inject.vue'
export { Inject }

import type { ComponentProps } from 'vue-component-type-helpers'

import { Global } from '@/global'

export type GlobalInjectionsConfig<T extends keyof GlobalInjections = keyof GlobalInjections> = {
  key: T
  component: Raw<GlobalInjections[T]>
  condition: (args: ComponentProps<GlobalInjections[T]>) => boolean | Promise<boolean>
}

export interface GlobalInjections extends Record<string, Component> {}

export const addInjection = <
  T extends keyof GlobalInjections,
  TCfg extends GlobalInjectionsConfig<T> = GlobalInjectionsConfig<T>
>(
  key: TCfg['key'],
  value: TCfg['component'],
  condition?: TCfg['condition']
) => {
  Global.envExtends.add({ key, component: value, condition: condition ?? (() => true) })
}