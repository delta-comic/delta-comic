<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/shared/components/AppIcon.vue'
import StatusMark from '@/shared/components/StatusMark.vue'
import type { StatusTone } from '@/shared/components/types'

const props = defineProps<{
  apiBaseUrl: string
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
}>()

const emit = defineEmits<{ menu: []; openSettings: [] }>()

const statusLabel = computed(() => {
  if (props.connectionStatus === 'connected') return '已连接'
  if (props.connectionStatus === 'connecting') return '连接中'
  if (props.connectionStatus === 'error') return '连接异常'
  return '未连接'
})

const statusTone = computed<StatusTone>(() => {
  if (props.connectionStatus === 'connected') return 'success'
  if (props.connectionStatus === 'connecting') return 'warning'
  if (props.connectionStatus === 'error') return 'danger'
  return 'muted'
})
</script>

<template>
  <header
    class="admin-topbar h-header border-border bg-topbar sticky top-0 z-10 flex items-center justify-end gap-6 border-b px-7 backdrop-blur-[12px] max-[860px]:justify-between max-[860px]:px-4"
  >
    <button
      class="admin-topbar__menu text-foreground hidden border-0 bg-transparent max-[860px]:block"
      type="button"
      aria-label="打开导航"
      @click="emit('menu')"
    >
      <AppIcon name="menu" />
    </button>
    <div
      class="admin-topbar__endpoint text-muted-foreground flex min-w-0 items-center gap-2.5 text-xs"
    >
      <span class="max-[860px]:hidden">当前 API 端点</span>
      <code
        class="border-border bg-surface-muted text-foreground-secondary max-w-[min(40vw,520px)] overflow-hidden rounded-sm border px-2.5 py-[7px] font-mono text-xs text-ellipsis whitespace-nowrap max-[860px]:max-w-[42vw]"
        >{{ apiBaseUrl || '尚未配置' }}</code
      >
    </div>
    <div class="admin-topbar__actions flex items-center gap-5">
      <StatusMark :label="statusLabel" :tone="statusTone" />
      <button
        class="admin-topbar__settings text-foreground-secondary hover:text-brand flex cursor-pointer items-center gap-[7px] border-0 bg-transparent p-1.5 text-xs"
        type="button"
        @click="emit('openSettings')"
      >
        <AppIcon name="gear" :size="18" />
        <span class="max-[860px]:hidden">设置</span>
      </button>
    </div>
  </header>
</template>