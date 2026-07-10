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
  border-left: 1px solid var(--dc-border);
}

.runtime-summary section {
  padding: 20px 24px;
  border-bottom: 1px solid var(--dc-border);
}

.runtime-summary h2 {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 650;
}

.runtime-summary dl {
  display: grid;
  grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.2fr);
  gap: 10px 14px;
  margin: 0;
  font-size: 12px;
}

.runtime-summary dt {
  color: var(--dc-text-muted);
}

.runtime-summary dd {
  overflow: hidden;
  margin: 0;
  color: var(--dc-text-secondary);
  text-overflow: ellipsis;
}

.runtime-summary code {
  font-size: 10px;
}

.runtime-summary__checks {
  display: grid;
  gap: 12px;
}

.runtime-summary__issues {
  margin: 16px 0 0;
  padding-left: 18px;
  color: #9a6710;
  font-size: 11px;
}

@media (max-width: 960px) {
  .runtime-summary {
    border-top: 1px solid var(--dc-border);
    border-left: 0;
  }
}
</style>