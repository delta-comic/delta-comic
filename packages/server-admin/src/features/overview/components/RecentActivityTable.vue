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
  <section class="activity-panel min-w-0">
    <header
      class="activity-panel__header border-border flex items-center justify-between border-b px-[22px] pt-5 pb-3.5"
    >
      <h2 class="m-0 text-[15px] font-[650]">最近插件活动</h2>
      <RouterLink class="text-brand text-xs" to="/plugins?tab=activity">查看全部</RouterLink>
    </header>
    <div v-if="items.length" class="activity-panel__table-wrap overflow-x-auto">
      <table class="activity-panel__table admin-data-table">
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
              <code class="text-foreground text-[11px]">{{ item.pluginId }}</code>
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
    <div v-else class="admin-empty activity-panel__empty min-h-[250px]">暂无插件操作记录</div>
  </section>
</template>