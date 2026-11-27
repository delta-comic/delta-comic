<script setup lang="ts">
import { useThemeVars } from 'naive-ui'
import { computed, inject, onBeforeUnmount, provide, watch } from 'vue'

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

if (!parentConfig && typeof document !== 'undefined') {
  const rootStyle = document.documentElement.style
  const originalValues = new Map<`--${string}`, { priority: string; value: string }>()
  const syncedNames = new Set<`--${string}`>()

  const restoreOriginalValue = (name: `--${string}`) => {
    const original = originalValues.get(name)
    if (original?.value) rootStyle.setProperty(name, original.value, original.priority)
    else rootStyle.removeProperty(name)
  }

  const stopSyncingRootStyle = watch(
    mergedStyle,
    style => {
      const nextVariables = Object.entries(style).filter(
        (entry): entry is [`--${string}`, number | string] =>
          entry[0].startsWith('--') && entry[1] != null,
      )
      const nextNames = new Set(nextVariables.map(([name]) => name))

      for (const name of syncedNames) {
        if (!nextNames.has(name)) {
          restoreOriginalValue(name)
          syncedNames.delete(name)
        }
      }

      for (const [name, value] of nextVariables) {
        if (!originalValues.has(name)) {
          originalValues.set(name, {
            priority: rootStyle.getPropertyPriority(name),
            value: rootStyle.getPropertyValue(name),
          })
        }
        rootStyle.setProperty(name, String(value))
        syncedNames.add(name)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stopSyncingRootStyle()
    for (const name of syncedNames) restoreOriginalValue(name)
  })
}

provide(dcConfigInjectionKey, { locale: mergedLocale, style: mergedStyle, theme: mergedTheme })
</script>

<template>
  <div class="contents" :data-dc-theme="mergedTheme" :lang="mergedLocale" :style="mergedStyle">
    <slot />
  </div>
</template>