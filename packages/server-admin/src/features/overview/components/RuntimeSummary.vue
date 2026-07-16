<script setup lang="ts">
import type { AdminCapabilities, AdminOverview } from '@/shared/api/types'
import StatusMark from '@/shared/components/StatusMark.vue'

defineProps<{ capabilities: AdminCapabilities | null; overview: AdminOverview }>()

const formatTime = (value: string | number): string =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(value),
  )
</script>

<template>
  <aside class="runtime-summary border-border border-l max-[960px]:border-t max-[960px]:border-l-0">
    <section class="border-border border-b px-6 py-5">
      <h2 class="mt-0 mb-4 text-[15px] font-[650]">部署信息</h2>
      <dl
        class="m-0 grid grid-cols-[minmax(90px,0.8fr)_minmax(0,1.2fr)] gap-x-3.5 gap-y-2.5 text-xs"
      >
        <template v-if="overview.deployment.available">
          <dt class="text-muted-foreground">版本 ID</dt>
          <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
            <code class="text-[10px]">{{ overview.deployment.id }}</code>
          </dd>
          <dt class="text-muted-foreground">版本标签</dt>
          <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
            {{ overview.deployment.tag || '未标记' }}
          </dd>
          <dt class="text-muted-foreground">上传时间</dt>
          <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
            {{ formatTime(overview.deployment.timestamp) }}
          </dd>
        </template>
        <template v-else>
          <dt class="text-muted-foreground">版本元数据</dt>
          <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">未绑定</dd>
        </template>
        <dt class="text-muted-foreground">观测时间</dt>
        <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
          {{ formatTime(overview.observedAt) }}
        </dd>
      </dl>
    </section>
    <section class="border-border border-b px-6 py-5">
      <h2 class="mt-0 mb-4 text-[15px] font-[650]">运行健康</h2>
      <div class="runtime-summary__checks grid gap-3">
        <StatusMark
          label="D1 数据库"
          :tone="overview.health.database.status === 'healthy' ? 'success' : 'danger'"
        />
        <StatusMark
          v-for="(configured, key) in overview.health.requiredSecrets"
          :key="key"
          :label="String(key)"
          :tone="configured ? 'success' : 'warning'"
        />
      </div>
      <ul
        v-if="overview.health.issues.length"
        class="runtime-summary__issues text-warning-foreground mt-4 mb-0 pl-[18px] text-[11px]"
      >
        <li v-for="issue in overview.health.issues" :key="issue">{{ issue }}</li>
      </ul>
    </section>
    <section v-if="capabilities" class="border-border border-b px-6 py-5">
      <h2 class="mt-0 mb-4 text-[15px] font-[650]">配置限制</h2>
      <dl
        class="m-0 grid grid-cols-[minmax(90px,0.8fr)_minmax(0,1.2fr)] gap-x-3.5 gap-y-2.5 text-xs"
      >
        <dt class="text-muted-foreground">单次 Push</dt>
        <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
          {{ capabilities.server.configuration.syncMaxPushOps }}
        </dd>
        <dt class="text-muted-foreground">单次 Pull</dt>
        <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
          {{ capabilities.server.configuration.syncMaxPullChanges }}
        </dd>
        <dt class="text-muted-foreground">Access TTL</dt>
        <dd class="text-foreground-secondary m-0 overflow-hidden text-ellipsis">
          {{ capabilities.server.configuration.accessTokenTtlSeconds }} 秒
        </dd>
      </dl>
    </section>
  </aside>
</template>