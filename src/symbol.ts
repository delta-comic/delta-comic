import type { InjectionKey, ShallowRef } from "vue"

export const isShowMainHomeNavBar = <InjectionKey<ShallowRef<boolean>>>Symbol('showNavBar')

export const pluginName = 'core'