<script setup lang="ts">
import type { FormSingleConfigure } from '@delta-comic/model'
import { computed } from 'vue'

const props = defineProps<{ config: FormSingleConfigure; modelValue: any }>()
const emit = defineEmits<{ 'update:modelValue': [value: any] }>()
const value = computed({
  get: () => props.modelValue,
  set: next => emit('update:modelValue', next),
})
</script>

<template>
  <DcCell v-if="config.type === 'switch'" center :title="config.info">
    <template #right-icon>
      <DcFormSwitch :config v-model="value" />
    </template>
  </DcCell>
  <NPopselect v-else-if="config.type === 'string'" :options="[]" trigger="click" size="huge">
    <DcCell center :title="config.info" clickable>{{ value }}</DcCell>
    <template #empty>
      <DcFormString :config v-model="value" class="max-w-[80vw]!" />
    </template>
  </NPopselect>
  <NPopselect v-else-if="config.type === 'number'" :options="[]" trigger="click" size="huge">
    <DcCell center :title="config.info" clickable>{{ value }}</DcCell>
    <template #empty>
      <DcFormNumber :config v-model="value" class="max-w-[80vw]!" />
    </template>
  </NPopselect>
  <NPopselect
    v-else-if="config.type === 'radio'"
    v-model:value="value"
    :options="config.selects"
    trigger="click"
    placement="bottom-end"
    size="huge"
  >
    <DcCell center :title="config.info" clickable>
      {{ config.selects.find(option => option.value === value)?.label }}
    </DcCell>
  </NPopselect>
  <NPopselect
    v-else-if="config.type === 'checkbox'"
    v-model:value="value"
    :options="config.selects"
    trigger="click"
    placement="bottom-end"
    size="huge"
    multiple
  >
    <DcCell center :title="config.info" clickable>{{ value }}</DcCell>
  </NPopselect>
  <DcVar
    v-else-if="config.type === 'date' || config.type === 'dateRange' || config.type === 'pairs'"
    :value="{ show: false }"
    v-slot="{ value: modal }"
  >
    <DcCell center :title="config.info" clickable @click="modal.show = true">
      {{ value }}
      <NModal v-model:show="modal.show" preset="dialog" :title="String(value ?? '')">
        <DcFormDate v-if="config.type === 'date'" :config v-model="value" class="max-w-[80vw]!" />
        <DcFormDateRange
          v-else-if="config.type === 'dateRange'"
          :config
          v-model="value"
          class="max-w-[80vw]!"
        />
        <DcFormPairs v-else :config v-model="value" class="max-w-[80vw]!" />
      </NModal>
    </DcCell>
  </DcVar>
</template>