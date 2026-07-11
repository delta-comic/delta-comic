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
  @apply [max-width:1440px];
  @apply [margin:0_auto];
}

.observability-page__layout {
  @apply [display:grid];
  @apply [grid-template-columns:minmax(0,_1fr)_330px];
  @apply [gap:22px];
}

.observability-page header {
  @apply [display:flex];
  @apply [align-items:center];
  @apply [justify-content:space-between];
  @apply [padding:18px_20px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.observability-page h2 {
  @apply [margin:0];
  @apply [font-size:15px];
}

.observability-page header span {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:11px];
}

.observability-page__metric-grid {
  @apply [display:grid];
  @apply [grid-template-columns:repeat(3,_minmax(0,_1fr))];
}

.observability-page__metric-grid article {
  @apply [display:grid];
  @apply [min-height:150px];
  @apply [align-content:center];
  @apply [padding:20px];
  @apply [border-right:1px_solid_var(--dc-border)];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.observability-page__metric-grid article > div {
  @apply [display:flex];
  @apply [gap:8px];
  @apply [align-items:center];
  @apply [justify-content:space-between];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:12px];
}

.observability-page__metric-grid strong {
  @apply [margin:14px_0_8px];
  @apply [font-size:30px];
  @apply [font-weight:640];
}

.observability-page__metric-grid code {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:10px];
}

.observability-page__readiness {
  @apply [align-self:start];
  @apply [padding-bottom:20px];
}

.observability-page__readiness > :not(header) {
  @apply [margin:18px_20px_0];
}

.observability-page__readiness dl {
  @apply [display:grid];
  @apply [grid-template-columns:1fr_auto];
  @apply [gap:11px];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:11px];
}

.observability-page__readiness dd {
  @apply [margin:0];
}

@media (max-width: 1040px) {
  .observability-page__layout {
    @apply [grid-template-columns:1fr];
  }
}

@media (max-width: 680px) {
  .observability-page__metric-grid {
    @apply [grid-template-columns:1fr_1fr];
  }
}
</style>