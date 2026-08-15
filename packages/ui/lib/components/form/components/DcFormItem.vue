<script setup lang="ts" generic="T extends FormSingleConfigure">
import type { FormDefaultValue, FormSingleConfigure, FormSingleResult } from '@delta-comic/model'
import { NFormItem } from 'naive-ui'

import DcFormCheckbox from './DcFormCheckbox.vue'
import DcFormDate from './DcFormDate.vue'
import DcFormDateRange from './DcFormDateRange.vue'
import DcFormNumber from './DcFormNumber.vue'
import DcFormPairs from './DcFormPairs.vue'
import DcFormRadio from './DcFormRadio.vue'
import DcFormString from './DcFormString.vue'
import DcFormSwitch from './DcFormSwitch.vue'

defineProps<{ config: T; path: string | number | symbol }>()
const store = defineModel<FormSingleResult<T>>({ required: true })
const write = (value: FormDefaultValue[keyof FormDefaultValue]): void => {
  store.value = value as FormSingleResult<T>
}
</script>

<template>
  <NFormItem :label="config.info" :path="path as string" :required="config.required ?? true">
    <DcFormSwitch
      :config
      :model-value="store as FormDefaultValue['switch']"
      @update:model-value="write"
      v-if="config.type == 'switch'"
    />
    <DcFormString
      :config
      :model-value="store as FormDefaultValue['string']"
      @update:model-value="write"
      v-else-if="config.type == 'string'"
    />
    <DcFormNumber
      :config
      :model-value="store as FormDefaultValue['number']"
      @update:model-value="write"
      v-else-if="config.type == 'number'"
    />
    <DcFormRadio
      :config
      :model-value="store as FormDefaultValue['radio']"
      @update:model-value="write"
      v-else-if="config.type == 'radio'"
    />
    <DcFormCheckbox
      :config
      :model-value="store as FormDefaultValue['checkbox']"
      @update:model-value="write"
      v-else-if="config.type == 'checkbox'"
    />
    <DcFormDate
      :config
      :model-value="store as FormDefaultValue['date']"
      @update:model-value="write"
      v-else-if="config.type == 'date'"
    />
    <DcFormDateRange
      :config
      :model-value="store as FormDefaultValue['dateRange']"
      @update:model-value="write"
      v-else-if="config.type == 'dateRange'"
    />
    <DcFormPairs
      :config
      :model-value="store as FormDefaultValue['pairs']"
      @update:model-value="write"
      v-else-if="config.type == 'pairs'"
    />
  </NFormItem>
</template>