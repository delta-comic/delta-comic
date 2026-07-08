<script setup lang="ts">
import { computed } from 'vue'

import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()
const docsUrl = computed(() =>
  adminStore.isConfigured ? adminStore.endpoint(adminStore.docsPath) : '',
)
const jsonUrl = computed(() =>
  adminStore.isConfigured ? adminStore.endpoint(adminStore.openapiJsonPath) : '',
)
</script>

<template>
  <NCard title="OpenAPI">
    <NSpace vertical>
      <NAlert type="info" title="文档入口">
        这些链接指向 Worker 公开的 OpenAPI 文档。Cloudflare Pages 只做跳转，不代理 API token 或
        secret。
      </NAlert>
      <NSpace>
        <NButton
          tag="a"
          :href="docsUrl"
          target="_blank"
          :disabled="!adminStore.isConfigured"
          type="primary"
        >
          打开 OpenAPI UI
        </NButton>
        <NButton tag="a" :href="jsonUrl" target="_blank" :disabled="!adminStore.isConfigured">
          打开 JSON Schema
        </NButton>
      </NSpace>
    </NSpace>
  </NCard>
</template>