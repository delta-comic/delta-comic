<script setup lang="ts" generic="T extends FormConfigure, O extends (keyof T)[] = (keyof T)[]">
import type { FormConfigure, FormResult } from '@delta-comic/model'
import { isArray } from 'es-toolkit/compat'
import { NForm } from 'naive-ui'

import type { FormRowSlot } from '../type'

import DcFormItem from './DcFormItem.vue'

const props = defineProps<{
  configs: T
  /**
   * 设置为`true`，则所有的`DcFormItem`都会替换；如果是数组，则它仅替换数组内包含的`key`的`DcFormItem`
   */
  overrideRow?: boolean | O
}>()
const result = defineModel<FormResult<T>>({ required: true })
const entries = Object.entries(props.configs) as [keyof T, T[keyof T]][]

const slots = defineSlots<{
  row?<K extends O[number]>(args: FormRowSlot<T, O, K>): any
  top?(args: { config: T }): any
  bottom?(args: { config: T }): any
}>()
</script>

<template>
  <NForm :model="result">
    <slot name="top" :config="configs" />
    <template v-for="[path, config] of entries">
      <slot
        name="row"
        :modelValue="result[path]"
        :setModelValue="v => (result[path] = v)"
        :path
        :config
        v-if="slots.row && (isArray(overrideRow) ? overrideRow.includes(path) : overrideRow)"
      />
      <DcFormItem
        :modelValue="result[path] as any"
        @update:modelValue="v => (result[path] = v as any)"
        :path
        :config
        v-else
      />
    </template>
    <slot name="bottom" :config="configs" />
  </NForm>
</template>