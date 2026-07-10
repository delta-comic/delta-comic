<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import AppIcon from '@/shared/components/AppIcon.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import StatusMark from '@/shared/components/StatusMark.vue'
import { useConnectionStore } from '@/stores/connection'
import { useOverviewStore } from '@/stores/overview'

const connection = useConnectionStore()
const store = useOverviewStore()
const { data, error, loading } = storeToRefs(store)
const { load } = store

const formatNumber = (value: number): string => new Intl.NumberFormat('zh-CN').format(value)

onMounted(() => {
  if (connection.hasCredentials && !data.value) void load()
})
</script>

<template>
  <div class="dc-page observability-page">
    <PageHeader
      title="运行指标"
      description="来自 D1 固定低基数查询的实时快照；不伪造 Worker uptime 或内存指标"
    >
      <template #actions>
        <NButton :loading="loading" secondary @click="load">
          <template #icon><AppIcon name="refresh" :size="17" /></template>刷新
        </NButton>
      </template>
    </PageHeader>
    <div v-if="error" class="dc-error-banner">{{ error }}</div>
    <section v-if="data" class="observability-page__layout">
      <div class="dc-panel observability-page__metrics">
        <header>
          <h2>数据规模</h2>
          <span>单位：count</span>
        </header>
        <div class="observability-page__metric-grid">
          <article v-for="metric in data.metrics" :key="metric.key">
            <div>
              <span>{{ metric.label }}</span>
              <StatusMark
                :label="metric.status === 'ok' ? '可用' : '降级'"
                :tone="metric.status === 'ok' ? 'success' : 'warning'"
              />
            </div>
            <strong>{{ formatNumber(metric.value) }}</strong>
            <code>{{ metric.source.table }}</code>
          </article>
        </div>
      </div>
      <div class="dc-panel observability-page__readiness">
        <header><h2>就绪检查</h2></header>
        <StatusMark
          :label="
            data.health.ready
              ? '服务就绪'
              : data.health.status === 'unhealthy'
                ? '服务不可用'
                : '服务降级'
          "
          :tone="
            data.health.ready
              ? 'success'
              : data.health.status === 'unhealthy'
                ? 'danger'
                : 'warning'
          "
        />
        <dl>
          <template v-for="(configured, key) in data.health.requiredSecrets" :key="key">
            <dt>{{ key }}</dt>
            <dd>{{ configured ? '已配置' : '缺失' }}</dd>
          </template>
        </dl>
        <NAlert v-if="data.health.issues.length" type="warning" title="需要处理">
          {{ data.health.issues.join(' · ') }}
        </NAlert>
      </div>
    </section>
    <NSkeleton v-else :repeat="10" text />
  </div>
</template>

<style scoped>
.observability-page {
  max-width: 1440px;
  margin: 0 auto;
}

.observability-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 22px;
}

.observability-page header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--dc-border);
}

.observability-page h2 {
  margin: 0;
  font-size: 15px;
}

.observability-page header span {
  color: var(--dc-text-muted);
  font-size: 11px;
}

.observability-page__metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.observability-page__metric-grid article {
  display: grid;
  min-height: 150px;
  align-content: center;
  padding: 20px;
  border-right: 1px solid var(--dc-border);
  border-bottom: 1px solid var(--dc-border);
}

.observability-page__metric-grid article > div {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  color: var(--dc-text-secondary);
  font-size: 12px;
}

.observability-page__metric-grid strong {
  margin: 14px 0 8px;
  font-size: 30px;
  font-weight: 640;
}

.observability-page__metric-grid code {
  color: var(--dc-text-muted);
  font-size: 10px;
}

.observability-page__readiness {
  align-self: start;
  padding-bottom: 20px;
}

.observability-page__readiness > :not(header) {
  margin: 18px 20px 0;
}

.observability-page__readiness dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 11px;
  color: var(--dc-text-secondary);
  font-size: 11px;
}

.observability-page__readiness dd {
  margin: 0;
}

@media (max-width: 1040px) {
  .observability-page__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .observability-page__metric-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>