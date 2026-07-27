<script setup lang="ts">
import { useThemeVars } from 'naive-ui'
import { computed, inject, provide } from 'vue'

import {
  dcConfigInjectionKey,
  type DcConfigProviderProps,
  type DcConfigStyle,
} from './config-provider/context'

defineOptions({ name: 'DcConfigProvider' })

const props = defineProps<DcConfigProviderProps>()
defineSlots<{ default(): unknown }>()

const parentConfig = inject(dcConfigInjectionKey, undefined)
const naiveThemeVars = useThemeVars()

const toCssVariableName = (name: string) =>
  `--nui-${name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
    .toLowerCase()}` as const

const naiveStyle = computed<DcConfigStyle>(() => {
  const style: DcConfigStyle = {}
  for (const [name, value] of Object.entries(naiveThemeVars.value)) {
    if (value == null) continue
    style[toCssVariableName(name)] = value
  }
  return style
})

const mergedLocale = computed(() => props.locale ?? parentConfig?.locale.value)
const mergedTheme = computed(() => props.theme ?? parentConfig?.theme.value)
const mergedStyle = computed<Readonly<DcConfigStyle>>(() => ({
  ...naiveStyle.value,
  ...parentConfig?.style.value,
  ...props.style,
}))

provide(dcConfigInjectionKey, { locale: mergedLocale, style: mergedStyle, theme: mergedTheme })
</script>

<template>
  <div class="contents" :data-dc-theme="mergedTheme" :lang="mergedLocale" :style="mergedStyle">
    <slot />
  </div>
</template>