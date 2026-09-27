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
  <div class="admin-page observability-page max-w-[1440px]">
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
    <div v-if="error" class="admin-error">{{ error }}</div>
    <section
      v-if="data"
      class="observability-page__layout grid grid-cols-[minmax(0,1fr)_330px] gap-[22px] max-[1040px]:grid-cols-1"
    >
      <div class="admin-panel observability-page__metrics">
        <header class="border-border flex items-center justify-between border-b px-5 py-[18px]">
          <h2 class="m-0 text-[15px]">数据规模</h2>
          <span class="text-muted-foreground text-[11px]">单位：count</span>
        </header>
        <div class="observability-page__metric-grid grid grid-cols-3 max-[680px]:grid-cols-2">
          <article
            v-for="metric in data.metrics"
            :key="metric.key"
            class="border-border grid min-h-[150px] content-center border-r border-b p-5"
          >
            <div class="text-foreground-secondary flex items-center justify-between gap-2 text-xs">
              <span>{{ metric.label }}</span>
              <StatusMark
                :label="metric.status === 'ok' ? '可用' : '降级'"
                :tone="metric.status === 'ok' ? 'success' : 'warning'"
              />
            </div>
            <strong class="mt-3.5 mb-2 text-3xl font-[640]">{{
              formatNumber(metric.value)
            }}</strong>
            <code class="text-muted-foreground text-[10px]">{{ metric.source.table }}</code>
          </article>
        </div>
      </div>
      <div class="admin-panel observability-page__readiness self-start pb-5">
        <header class="border-border flex items-center justify-between border-b px-5 py-[18px]">
          <h2 class="m-0 text-[15px]">就绪检查</h2>
        </header>
        <div class="mx-5 mt-[18px]">
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
        </div>
        <dl
          class="text-foreground-secondary mx-5 mt-[18px] grid grid-cols-[1fr_auto] gap-[11px] text-[11px]"
        >
          <template v-for="(configured, key) in data.health.requiredSecrets" :key="key">
            <dt>{{ key }}</dt>
            <dd class="m-0">{{ configured ? '已配置' : '缺失' }}</dd>
          </template>
        </dl>
        <NAlert
          v-if="data.health.issues.length"
          class="mx-5 mt-[18px]"
          type="warning"
          title="需要处理"
        >
          {{ data.health.issues.join(' · ') }}
        </NAlert>
      </div>
    </section>
    <NSkeleton v-else :repeat="10" text />
  </div>
</template>