<script setup lang="ts">
import type { AdminActivityItem } from '@/shared/api/types'
import StatusMark from '@/shared/components/StatusMark.vue'

defineProps<{ items: AdminActivityItem[] }>()

const formatTime = (value: number): string =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(value),
  )
</script>

<template>
  <section class="activity-panel">
    <header class="activity-panel__header">
      <h2>最近插件活动</h2>
      <RouterLink to="/plugins?tab=activity">查看全部</RouterLink>
    </header>
    <div v-if="items.length" class="activity-panel__table-wrap">
      <table class="activity-panel__table">
        <thead>
          <tr>
            <th>时间</th>
            <th>插件</th>
            <th>操作</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items.slice(0, 8)" :key="item.id">
            <td>{{ formatTime(item.createdAt) }}</td>
            <td>
              <code>{{ item.pluginId }}</code>
            </td>
            <td>{{ item.action }}</td>
            <td>
              <StatusMark
                :label="item.outcome === 'succeeded' ? '成功' : '失败'"
                :tone="item.outcome === 'succeeded' ? 'success' : 'danger'"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="dc-empty activity-panel__empty">暂无插件操作记录</div>
  </section>
</template>

<style scoped>
.activity-panel {
  @apply [min-width:0];
}

.activity-panel__header {
  @apply [display:flex];
  @apply [align-items:center];
  @apply [justify-content:space-between];
  @apply [padding:20px_22px_14px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.activity-panel__header h2 {
  @apply [margin:0];
  @apply [font-size:15px];
  @apply [font-weight:650];
}

.activity-panel__header a {
  @apply [color:var(--dc-blue)];
  @apply [font-size:12px];
}

.activity-panel__table-wrap {
  @apply [overflow-x:auto];
}

.activity-panel__table {
  @apply [width:100%];
  @apply [border-collapse:collapse];
  @apply [font-size:12px];
}

.activity-panel__table th,
.activity-panel__table td {
  @apply [padding:13px_18px];
  @apply [text-align:left];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.activity-panel__table th {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:11px];
  @apply [font-weight:550];
  @apply [background:var(--dc-surface-soft)];
}

.activity-panel__table td {
  @apply [color:var(--dc-text-secondary)];
}

.activity-panel__table code {
  @apply [color:var(--dc-text)];
  @apply [font-size:11px];
}

.activity-panel__empty {
  @apply [min-height:250px];
}
</style>