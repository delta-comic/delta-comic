<script setup lang="ts" generic="T extends Configure, O extends (keyof T)[] = (keyof T)[]">
import { isArray } from 'es-toolkit/compat'
import { NForm } from 'naive-ui'

import type { Configure, FormRowSlot, Result } from '../type'

import DcFormItem from './DcFormItem.vue'

defineProps<{
  configs: T
  /**
   * 设置为`true`，则所有的`DcFormItem`都会替换；如果是数组，则它仅替换数组内包含的`key`的`DcFormItem`
   */
  overrideRow?: boolean | O
}>()
const result = defineModel<Result<T>>({ default: {} })


const slots = defineSlots<{
  row?<K extends O[number]>(args: FormRowSlot<T, O, K>): any
  top?(args: { config: T }): any
  bottom?(args: { config: T }): any
}>()
</script>

<template>
  <NForm :model="result">
    <slot name="top" :config="configs" />
    <template v-for="[path, config] of Object.entries(configs)">
      <slot
        name="row"
        :modelValue="result[path]"
        :setModelValue="v => ((result[path] as any) = v)"
        :path
        :config="config as any"
        v-if="slots.row && (isArray(overrideRow) ? overrideRow.includes(path) : overrideRow)"
      />
      <DcFormItem v-model="result[path]" :path :config v-else />
    </template>
    <slot name="bottom" :config="configs" />
  </NForm>
</template>