<script setup lang="ts">
import type { ServerPluginAuditEvent, ServerPluginJob } from '@delta-comic/server'

import StatusMark from '@/shared/components/StatusMark.vue'

defineProps<{ audit: ServerPluginAuditEvent[]; jobs: ServerPluginJob[] }>()

const formatTime = (value: number): string =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(value),
  )
</script>

<template>
  <div class="plugin-activity grid gap-5">
    <section class="admin-panel overflow-x-auto">
      <header class="border-border flex items-center justify-between border-b px-[18px] py-4">
        <h2 class="m-0 text-sm">最近任务</h2>
        <span class="text-muted-foreground text-[11px]">{{ jobs.length }} 条</span>
      </header>
      <table
        v-if="jobs.length"
        class="admin-data-table text-[11px] [&_code]:text-[10px] [&_td]:px-3.5 [&_td]:py-[11px] [&_th]:px-3.5 [&_th]:py-[11px]"
      >
        <thead>
          <tr>
            <th>时间</th>
            <th>插件</th>
            <th>操作</th>
            <th>状态</th>
            <th>错误</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="job in jobs" :key="job.id">
            <td>{{ formatTime(job.createdAt) }}</td>
            <td>
              <code>{{ job.pluginId }}</code>
            </td>
            <td>{{ job.action }}</td>
            <td>
              <StatusMark
                :label="job.status"
                :tone="
                  job.status === 'succeeded'
                    ? 'success'
                    : job.status === 'failed'
                      ? 'danger'
                      : 'warning'
                "
              />
            </td>
            <td>{{ job.errorMessage ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="admin-empty">暂无插件任务</div>
    </section>
    <section class="admin-panel overflow-x-auto">
      <header class="border-border flex items-center justify-between border-b px-[18px] py-4">
        <h2 class="m-0 text-sm">审计记录</h2>
        <span class="text-muted-foreground text-[11px]">{{ audit.length }} 条</span>
      </header>
      <table
        v-if="audit.length"
        class="admin-data-table text-[11px] [&_code]:text-[10px] [&_td]:px-3.5 [&_td]:py-[11px] [&_th]:px-3.5 [&_th]:py-[11px]"
      >
        <thead>
          <tr>
            <th>时间</th>
            <th>插件</th>
            <th>操作</th>
            <th>操作者</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in audit" :key="item.id">
            <td>{{ formatTime(item.createdAt) }}</td>
            <td>
              <code>{{ item.pluginId }}</code>
            </td>
            <td>{{ item.action }}</td>
            <td>{{ item.actorId }}</td>
            <td>
              <StatusMark
                :label="item.outcome"
                :tone="item.outcome === 'succeeded' ? 'success' : 'danger'"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="admin-empty">暂无审计记录</div>
    </section>
  </div>
</template>