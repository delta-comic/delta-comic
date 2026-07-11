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
  <div class="plugin-activity">
    <section class="dc-panel">
      <header>
        <h2>最近任务</h2>
        <span>{{ jobs.length }} 条</span>
      </header>
      <table v-if="jobs.length">
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
      <div v-else class="dc-empty">暂无插件任务</div>
    </section>
    <section class="dc-panel">
      <header>
        <h2>审计记录</h2>
        <span>{{ audit.length }} 条</span>
      </header>
      <table v-if="audit.length">
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
      <div v-else class="dc-empty">暂无审计记录</div>
    </section>
  </div>
</template>

<style scoped>
.plugin-activity {
  @apply [display:grid];
  @apply [gap:20px];
}

.plugin-activity header {
  @apply [display:flex];
  @apply [align-items:center];
  @apply [justify-content:space-between];
  @apply [padding:16px_18px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.plugin-activity h2 {
  @apply [margin:0];
  @apply [font-size:14px];
}

.plugin-activity header span {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:11px];
}

.plugin-activity table {
  @apply [width:100%];
  @apply [border-collapse:collapse];
  @apply [font-size:11px];
}

.plugin-activity th,
.plugin-activity td {
  @apply [padding:11px_14px];
  @apply [text-align:left];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.plugin-activity th {
  @apply [color:var(--dc-text-muted)];
  @apply [font-weight:550];
  @apply [background:var(--dc-surface-soft)];
}

.plugin-activity code {
  @apply [font-size:10px];
}
</style>