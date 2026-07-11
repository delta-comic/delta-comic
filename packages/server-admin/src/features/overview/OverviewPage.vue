<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import AppIcon from '@/shared/components/AppIcon.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useConnectionStore } from '@/stores/connection'
import { useOverviewStore } from '@/stores/overview'

import OverviewMetricBand from './components/OverviewMetricBand.vue'
import RecentActivityTable from './components/RecentActivityTable.vue'
import RuntimeSummary from './components/RuntimeSummary.vue'

const connection = useConnectionStore()
const overviewStore = useOverviewStore()
const { data, error, loading } = storeToRefs(overviewStore)
const { load } = overviewStore

onMounted(() => {
  if (connection.hasCredentials) void load()
})
</script>

<template>
  <div class="dc-page overview-page">
    <PageHeader title="服务总览" description="Worker、D1 与插件运行状态">
      <template #actions>
        <NButton :loading="loading" secondary @click="load">
          <template #icon><AppIcon name="refresh" :size="17" /></template>
          刷新数据
        </NButton>
      </template>
    </PageHeader>

    <div v-if="error" class="dc-error-banner">{{ error }}</div>
    <NResult
      v-if="!connection.hasCredentials"
      status="info"
      title="尚未连接 Server API"
      description="请先在设置中填写 Worker 地址与管理员令牌。"
    >
      <template #footer
        ><NButton type="primary" @click="$router.push('/settings')">打开设置</NButton></template
      >
    </NResult>
    <template v-else-if="data">
      <OverviewMetricBand :overview="data" />
      <section class="overview-page__body dc-panel">
        <RecentActivityTable :items="data.recentActivity.items" />
        <RuntimeSummary :capabilities="connection.capabilities" :overview="data" />
      </section>
    </template>
    <NSkeleton v-else :repeat="8" text />
  </div>
</template>

<style scoped>
.overview-page {
  @apply [max-width:1600px];
  @apply [margin:0_auto];
}

.overview-page__body {
  @apply [display:grid];
  @apply [grid-template-columns:minmax(0,_1fr)_360px];
  @apply [margin-top:24px];
}

@media (max-width: 960px) {
  .overview-page__body {
    @apply [grid-template-columns:1fr];
  }
}
</style>