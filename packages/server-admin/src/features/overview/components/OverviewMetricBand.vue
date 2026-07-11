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
  @apply [display:grid];
  @apply [grid-template-columns:repeat(6,_minmax(135px,_1fr))];
  @apply [border-top:1px_solid_var(--dc-border)];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.metric-band__item {
  @apply [display:grid];
  @apply [min-height:116px];
  @apply [align-content:center];
  @apply [padding:18px_24px];
  @apply [border-right:1px_solid_var(--dc-border)];
}

.metric-band__item:last-child {
  @apply [border-right:0];
}

.metric-band__label {
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:12px];
}

.metric-band strong {
  @apply [margin:8px_0_5px];
  @apply [color:var(--dc-text)];
  @apply [font-size:25px];
  @apply [font-weight:650];
  @apply [line-height:1];
}

.metric-band__health strong {
  @apply [color:var(--dc-green)];
}

.metric-band__source {
  @apply [overflow:hidden];
  @apply [color:var(--dc-text-muted)];
  @apply [font-family:ui-monospace,_SFMono-Regular,_Menlo,_monospace];
  @apply [font-size:10px];
  @apply [text-overflow:ellipsis];
  @apply [white-space:nowrap];
}

@media (max-width: 1180px) {
  .metric-band {
    @apply [grid-template-columns:repeat(3,_minmax(150px,_1fr))];
  }

  .metric-band__item:nth-child(3n) {
    @apply [border-right:0];
  }

  .metric-band__item:nth-child(-n + 3) {
    @apply [border-bottom:1px_solid_var(--dc-border)];
  }
}

@media (max-width: 640px) {
  .metric-band {
    @apply [grid-template-columns:repeat(2,_minmax(0,_1fr))];
  }

  .metric-band__item,
  .metric-band__item:nth-child(3n) {
    @apply [min-height:104px];
    @apply [padding:16px];
    @apply [border-right:1px_solid_var(--dc-border)];
    @apply [border-bottom:1px_solid_var(--dc-border)];
  }

  .metric-band__item:nth-child(even) {
    @apply [border-right:0];
  }
}
</style>