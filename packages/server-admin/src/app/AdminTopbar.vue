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
  @apply [position:sticky];
  @apply [z-index:10];
  @apply [top:0];
  @apply [display:flex];
  @apply [height:var(--dc-header-height)];
  @apply [gap:24px];
  @apply [align-items:center];
  @apply [justify-content:flex-end];
  @apply [padding:0_28px];
  @apply [background:var(--dc-topbar)];
  @apply [border-bottom:1px_solid_var(--dc-border)];
  @apply [backdrop-filter:blur(12px)];
}

.admin-topbar__menu {
  @apply [display:none];
  @apply [color:var(--dc-text)];
  @apply [background:none];
  @apply [border:0];
}

.admin-topbar__endpoint {
  @apply [display:flex];
  @apply [min-width:0];
  @apply [gap:10px];
  @apply [align-items:center];
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:12px];
}

.admin-topbar__endpoint code {
  @apply [overflow:hidden];
  @apply [max-width:min(40vw,_520px)];
  @apply [padding:7px_10px];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-family:ui-monospace,_SFMono-Regular,_Menlo,_monospace];
  @apply [font-size:12px];
  @apply [text-overflow:ellipsis];
  @apply [white-space:nowrap];
  @apply [background:var(--dc-surface-soft)];
  @apply [border:1px_solid_var(--dc-border)];
  @apply [border-radius:4px];
}

.admin-topbar__actions {
  @apply [display:flex];
  @apply [gap:20px];
  @apply [align-items:center];
}

.admin-topbar__settings {
  @apply [display:flex];
  @apply [gap:7px];
  @apply [align-items:center];
  @apply [padding:6px];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:12px];
  @apply [background:transparent];
  @apply [border:0];
  @apply [cursor:pointer];
}

.admin-topbar__settings:hover {
  @apply [color:var(--dc-blue)];
}

@media (max-width: 860px) {
  .admin-topbar {
    @apply [justify-content:space-between];
    @apply [padding:0_16px];
  }

  .admin-topbar__menu {
    @apply [display:block];
  }

  .admin-topbar__endpoint > span,
  .admin-topbar__settings span {
    @apply [display:none];
  }

  .admin-topbar__endpoint code {
    @apply [max-width:42vw];
  }
}
</style>