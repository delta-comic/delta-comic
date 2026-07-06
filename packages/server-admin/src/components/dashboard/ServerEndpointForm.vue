<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; save: [value: string] }>()

const draft = ref(props.modelValue)

watch(
  () => props.modelValue,
  value => (draft.value = value),
)

const save = () => {
  emit('update:modelValue', draft.value)
  emit('save', draft.value)
}
</script>

<template>
  <n-card title="Server API 地址" embedded>
    <n-space vertical>
      <n-input-group>
        <n-input
          v-model:value="draft"
          placeholder="https://delta-comic-server.example.workers.dev"
          @keydown.enter="save"
        />
        <n-button type="primary" @click="save">保存</n-button>
      </n-input-group>
      <n-text depth="3">
        Pages 面板运行在浏览器中，只保存公开的 Worker API 根地址；不要在面板中写入 Cloudflare secret。
      </n-text>
    </n-space>
  </n-card>
</template>
