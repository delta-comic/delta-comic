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
  min-width: 0;
}

.activity-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--dc-border);
}

.activity-panel__header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.activity-panel__header a {
  color: var(--dc-blue);
  font-size: 12px;
}

.activity-panel__table-wrap {
  overflow-x: auto;
}

.activity-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.activity-panel__table th,
.activity-panel__table td {
  padding: 13px 18px;
  text-align: left;
  border-bottom: 1px solid var(--dc-border);
}

.activity-panel__table th {
  color: var(--dc-text-muted);
  font-size: 11px;
  font-weight: 550;
  background: var(--dc-surface-soft);
}

.activity-panel__table td {
  color: var(--dc-text-secondary);
}

.activity-panel__table code {
  color: var(--dc-text);
  font-size: 11px;
}

.activity-panel__empty {
  min-height: 250px;
}
</style>