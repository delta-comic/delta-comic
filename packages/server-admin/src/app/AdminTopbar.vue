<script setup lang="ts">
import AppIcon from '@/shared/components/AppIcon.vue'
import StatusMark from '@/shared/components/StatusMark.vue'
import type { StatusTone } from '@/shared/components/types'

const props = defineProps<{
  apiBaseUrl: string
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
}>()

const emit = defineEmits<{ menu: []; openSettings: [] }>()

const statusLabel = () => {
  if (props.connectionStatus === 'connected') return '已连接'
  if (props.connectionStatus === 'connecting') return '连接中'
  if (props.connectionStatus === 'error') return '连接异常'
  return '未连接'
}

const statusTone = (): StatusTone => {
  if (props.connectionStatus === 'connected') return 'success'
  if (props.connectionStatus === 'connecting') return 'warning'
  if (props.connectionStatus === 'error') return 'danger'
  return 'muted'
}
</script>

<template>
  <header class="admin-topbar">
    <button class="admin-topbar__menu" type="button" aria-label="打开导航" @click="emit('menu')">
      <AppIcon name="menu" />
    </button>
    <div class="admin-topbar__endpoint">
      <span>当前 API 端点</span>
      <code>{{ apiBaseUrl || '尚未配置' }}</code>
    </div>
    <div class="admin-topbar__actions">
      <StatusMark :label="statusLabel()" :tone="statusTone()" />
      <button class="admin-topbar__settings" type="button" @click="emit('openSettings')">
        <AppIcon name="gear" :size="18" />
        <span>设置</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.admin-topbar {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  height: var(--dc-header-height);
  gap: 24px;
  align-items: center;
  justify-content: flex-end;
  padding: 0 28px;
  background: rgb(255 255 255 / 94%);
  border-bottom: 1px solid var(--dc-border);
  backdrop-filter: blur(12px);
}

.admin-topbar__menu {
  display: none;
  color: var(--dc-text);
  background: none;
  border: 0;
}

.admin-topbar__endpoint {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: center;
  color: var(--dc-text-muted);
  font-size: 12px;
}

.admin-topbar__endpoint code {
  overflow: hidden;
  max-width: min(40vw, 520px);
  padding: 7px 10px;
  color: #3b4657;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--dc-surface-soft);
  border: 1px solid var(--dc-border);
  border-radius: 4px;
}

.admin-topbar__actions {
  display: flex;
  gap: 20px;
  align-items: center;
}

.admin-topbar__settings {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 6px;
  color: var(--dc-text-secondary);
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.admin-topbar__settings:hover {
  color: var(--dc-blue);
}

@media (max-width: 860px) {
  .admin-topbar {
    justify-content: space-between;
    padding: 0 16px;
  }

  .admin-topbar__menu {
    display: block;
  }

  .admin-topbar__endpoint > span,
  .admin-topbar__settings span {
    display: none;
  }

  .admin-topbar__endpoint code {
    max-width: 42vw;
  }
}
</style>