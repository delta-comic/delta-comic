import { inject, type ComputedRef, type CSSProperties, type InjectionKey } from 'vue'

export type DcConfigTheme = 'dark' | 'light'

export type DcConfigStyle = CSSProperties & Record<`--${string}`, number | string>

export interface DcConfigProviderProps {
  locale?: string
  style?: DcConfigStyle
  theme?: DcConfigTheme
}

export interface DcConfigContext {
  locale: ComputedRef<string | undefined>
  style: ComputedRef<Readonly<DcConfigStyle>>
  theme: ComputedRef<DcConfigTheme | undefined>
}

export const dcConfigInjectionKey: InjectionKey<DcConfigContext> = Symbol('dc-config')

export const useDcConfig = (): DcConfigContext => {
  const config = inject(dcConfigInjectionKey)
  if (!config) throw new Error('useDcConfig() must be called under <DcConfigProvider>.')
  return config
}