<script setup lang="ts" generic="T extends FormConfigure, O extends (keyof T)[] = (keyof T)[]">
import type {
  FormConfigure,
  FormDefaultValue,
  FormResult,
  FormSingleConfigure,
} from '@delta-comic/model'
import { isArray } from 'es-toolkit/compat'
import { NForm } from 'naive-ui'
import { computed } from 'vue'

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
const formModel = computed(
  () => result.value as Record<string, FormDefaultValue[keyof FormDefaultValue]>,
)
const entries = Object.entries(props.configs) as [string, FormSingleConfigure][]

const slots = defineSlots<{
  row?<K extends O[number]>(args: FormRowSlot<T, O, K>): any
  top?(args: { config: T }): any
  bottom?(args: { config: T }): any
}>()
</script>

<template>
  <NForm :model="formModel">
    <slot name="top" :config="configs" />
    <template v-for="[path, config] of entries">
      <slot
        name="row"
        :modelValue="formModel[path]"
        :setModelValue="v => (formModel[path] = v)"
        :path
        :config
        v-if="slots.row && (isArray(overrideRow) ? overrideRow.includes(path) : overrideRow)"
      />
      <DcFormItem v-model="formModel[path]" :path :config v-else />
    </template>
    <slot name="bottom" :config="configs" />
  </NForm>
</template>