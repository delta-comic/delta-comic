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
  <section
    class="metric-band border-border grid grid-cols-6 border-y max-[1180px]:grid-cols-3 max-sm:grid-cols-2"
    aria-label="服务关键指标"
  >
    <div
      class="metric-band__item metric-band__health border-border grid min-h-[116px] content-center border-r px-6 py-[18px] max-[1180px]:border-b max-sm:min-h-[104px] max-sm:border-b max-sm:px-4 max-sm:py-4 max-sm:odd:border-r max-sm:even:border-r-0"
    >
      <span class="metric-band__label text-foreground-secondary text-xs">服务状态</span>
      <strong class="text-success my-2 text-[25px] leading-none font-[650]">{{
        healthLabel
      }}</strong>
      <StatusMark
        :label="overview.health.database.status === 'healthy' ? 'D1 可用' : 'D1 异常'"
        :tone="healthTone"
      />
    </div>
    <div
      v-for="metric in visibleMetrics"
      :key="metric.key"
      class="metric-band__item border-border grid min-h-[116px] content-center border-r px-6 py-[18px] last:border-r-0 max-sm:min-h-[104px] max-sm:border-r max-sm:border-b max-sm:px-4 max-sm:py-4 max-sm:odd:border-r max-sm:even:border-r-0 max-[1180px]:[&:nth-child(-n+3)]:border-b max-[1180px]:[&:nth-child(3n)]:border-r-0"
    >
      <span class="metric-band__label text-foreground-secondary text-xs">{{ metric.label }}</span>
      <strong class="text-foreground my-2 text-[25px] leading-none font-[650]">{{
        formatValue(metric.value)
      }}</strong>
      <span
        class="metric-band__source text-muted-foreground overflow-hidden font-mono text-[10px] text-ellipsis whitespace-nowrap"
        >{{ metric.source.table }}</span
      >
    </div>
  </section>
</template>