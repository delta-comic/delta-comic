<script setup lang="ts">
import { computed } from 'vue'

import type { AdminOverview } from '@/shared/api/types'
import StatusMark from '@/shared/components/StatusMark.vue'

const props = defineProps<{ overview: AdminOverview }>()

const visibleMetrics = computed(() => props.overview.metrics.slice(0, 5))
const healthLabel = computed(() => {
  if (props.overview.health.status === 'ready') return '正常'
  if (props.overview.health.status === 'degraded') return '需要关注'
  return '不可用'
})
const healthTone = computed(() => {
  if (props.overview.health.status === 'ready') return 'success' as const
  if (props.overview.health.status === 'degraded') return 'warning' as const
  return 'danger' as const
})

const formatValue = (value: number): string => new Intl.NumberFormat('zh-CN').format(value)
</script>

<template>
  <section class="metric-band" aria-label="服务关键指标">
    <div class="metric-band__item metric-band__health">
      <span class="metric-band__label">服务状态</span>
      <strong>{{ healthLabel }}</strong>
      <StatusMark
        :label="overview.health.database.status === 'healthy' ? 'D1 可用' : 'D1 异常'"
        :tone="healthTone"
      />
    </div>
    <div v-for="metric in visibleMetrics" :key="metric.key" class="metric-band__item">
      <span class="metric-band__label">{{ metric.label }}</span>
      <strong>{{ formatValue(metric.value) }}</strong>
      <span class="metric-band__source">{{ metric.source.table }}</span>
    </div>
  </section>
</template>

<style scoped>
.metric-band {
  display: grid;
  grid-template-columns: repeat(6, minmax(135px, 1fr));
  border-top: 1px solid var(--dc-border);
  border-bottom: 1px solid var(--dc-border);
}

.metric-band__item {
  display: grid;
  min-height: 116px;
  align-content: center;
  padding: 18px 24px;
  border-right: 1px solid var(--dc-border);
}

.metric-band__item:last-child {
  border-right: 0;
}

.metric-band__label {
  color: var(--dc-text-secondary);
  font-size: 12px;
}

.metric-band strong {
  margin: 8px 0 5px;
  color: #172133;
  font-size: 25px;
  font-weight: 650;
  line-height: 1;
}

.metric-band__health strong {
  color: var(--dc-green);
}

.metric-band__source {
  overflow: hidden;
  color: var(--dc-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .metric-band {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }

  .metric-band__item:nth-child(3n) {
    border-right: 0;
  }

  .metric-band__item:nth-child(-n + 3) {
    border-bottom: 1px solid var(--dc-border);
  }
}

@media (max-width: 640px) {
  .metric-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-band__item,
  .metric-band__item:nth-child(3n) {
    min-height: 104px;
    padding: 16px;
    border-right: 1px solid var(--dc-border);
    border-bottom: 1px solid var(--dc-border);
  }

  .metric-band__item:nth-child(even) {
    border-right: 0;
  }
}
</style>