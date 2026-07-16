<script setup lang="ts">
import { computed } from 'vue'

import PageHeader from '@/shared/components/PageHeader.vue'
import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()
const docsUrl = computed(() =>
  connection.apiBaseUrl ? `${connection.apiBaseUrl}/api/openapi` : '',
)
const jsonUrl = computed(() =>
  connection.apiBaseUrl ? `${connection.apiBaseUrl}/api/openapi/json` : '',
)
</script>

<template>
  <div class="admin-page openapi-page max-w-[960px]">
    <PageHeader title="OpenAPI" description="查看 Worker 当前部署版本公开的接口说明与 schema" />
    <NCard title="接口文档" :bordered="true">
      <NAlert type="info" :show-icon="false">
        文档链接不会携带管理员令牌；受保护接口仍需在请求中显式填写 Bearer token。
      </NAlert>
      <NSpace class="openapi-page__actions mt-5">
        <NButton
          tag="a"
          :href="docsUrl || undefined"
          target="_blank"
          rel="noopener noreferrer"
          :disabled="!docsUrl"
          type="primary"
          >打开 OpenAPI UI</NButton
        >
        <NButton
          tag="a"
          :href="jsonUrl || undefined"
          target="_blank"
          rel="noopener noreferrer"
          :disabled="!jsonUrl"
          >打开 JSON Schema</NButton
        >
      </NSpace>
    </NCard>
  </div>
</template>