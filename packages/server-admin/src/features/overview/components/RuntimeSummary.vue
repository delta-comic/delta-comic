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
  <aside class="runtime-summary">
    <section>
      <h2>部署信息</h2>
      <dl>
        <template v-if="overview.deployment.available">
          <dt>版本 ID</dt>
          <dd>
            <code>{{ overview.deployment.id }}</code>
          </dd>
          <dt>版本标签</dt>
          <dd>{{ overview.deployment.tag || '未标记' }}</dd>
          <dt>上传时间</dt>
          <dd>{{ formatTime(overview.deployment.timestamp) }}</dd>
        </template>
        <template v-else>
          <dt>版本元数据</dt>
          <dd>未绑定</dd>
        </template>
        <dt>观测时间</dt>
        <dd>{{ formatTime(overview.observedAt) }}</dd>
      </dl>
    </section>
    <section>
      <h2>运行健康</h2>
      <div class="runtime-summary__checks">
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
      <ul v-if="overview.health.issues.length" class="runtime-summary__issues">
        <li v-for="issue in overview.health.issues" :key="issue">{{ issue }}</li>
      </ul>
    </section>
    <section v-if="capabilities">
      <h2>配置限制</h2>
      <dl>
        <dt>单次 Push</dt>
        <dd>{{ capabilities.server.configuration.syncMaxPushOps }}</dd>
        <dt>单次 Pull</dt>
        <dd>{{ capabilities.server.configuration.syncMaxPullChanges }}</dd>
        <dt>Access TTL</dt>
        <dd>{{ capabilities.server.configuration.accessTokenTtlSeconds }} 秒</dd>
      </dl>
    </section>
  </aside>
</template>

<style scoped>
.runtime-summary {
  @apply [border-left:1px_solid_var(--dc-border)];
}

.runtime-summary section {
  @apply [padding:20px_24px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.runtime-summary h2 {
  @apply [margin:0_0_16px];
  @apply [font-size:15px];
  @apply [font-weight:650];
}

.runtime-summary dl {
  @apply [display:grid];
  @apply [grid-template-columns:minmax(90px,_0.8fr)_minmax(0,_1.2fr)];
  @apply [gap:10px_14px];
  @apply [margin:0];
  @apply [font-size:12px];
}

.runtime-summary dt {
  @apply [color:var(--dc-text-muted)];
}

.runtime-summary dd {
  @apply [overflow:hidden];
  @apply [margin:0];
  @apply [color:var(--dc-text-secondary)];
  @apply [text-overflow:ellipsis];
}

.runtime-summary code {
  @apply [font-size:10px];
}

.runtime-summary__checks {
  @apply [display:grid];
  @apply [gap:12px];
}

.runtime-summary__issues {
  @apply [margin:16px_0_0];
  @apply [padding-left:18px];
  @apply [color:var(--dc-amber-text)];
  @apply [font-size:11px];
}

@media (max-width: 960px) {
  .runtime-summary {
    @apply [border-top:1px_solid_var(--dc-border)];
    @apply [border-left:0];
  }
}
</style>