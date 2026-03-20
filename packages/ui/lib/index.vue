<script setup lang="ts">
import type { Configure } from './form'
import DcForm from './form/components/DcForm.vue'
import DcFormItem from './form/components/DcFormItem.vue'

const config = {
  gay: { type: 'switch', info: 'Are you agy?', defaultValue: false, required: true },
  name: { type: 'string', info: 'What your name?', required: true },
  sex: {
    type: 'radio',
    comp: 'select',
    info: 'Sex?',
    selects: [
      { label: 'Never', value: 'never' },
      { label: 'Often', value: 'often' },
      { label: 'Everyday', value: 'everyday' }
    ]
  }
} satisfies Configure
</script>

<template>
  <DcForm :configs="config" :override-row="['gay', 'name']" row="{ config, path, modelValue }">
    <DcFormItem :config :path v-model="modelValue" v-if="path == 'gay'" />
    <div v-else>{{ config }}</div>
  </DcForm>
</template>