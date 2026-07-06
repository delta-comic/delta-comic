<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ healthUrl: string; disabled: boolean }>()

const loading = ref(false)
const status = ref<'idle' | 'ok' | 'error'>('idle')
const message = ref('尚未检测')

const tagType = computed(() => (status.value == 'ok' ? 'success' : status.value == 'error' ? 'error' : 'default'))

const check = async () => {
  if (props.disabled) return
  loading.value = true
  try {
    const response = await fetch(props.healthUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json() as { ok?: boolean; service?: string }
    status.value = body.ok ? 'ok' : 'error'
    message.value = body.ok ? `${body.service ?? 'server'} 正常` : '健康检查返回异常'
  } catch (error) {
    status.value = 'error'
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <n-card title="Worker 健康检查" embedded>
    <n-space vertical>
      <n-text code>{{ healthUrl || '请先配置 Server API 地址' }}</n-text>
      <n-space align="center">
        <n-button :disabled="disabled" :loading="loading" type="primary" @click="check">立即检测</n-button>
        <n-tag :type="tagType">{{ message }}</n-tag>
      </n-space>
    </n-space>
  </n-card>
</template>
