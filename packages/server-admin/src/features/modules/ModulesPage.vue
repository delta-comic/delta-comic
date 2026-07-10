<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PageHeader from '@/shared/components/PageHeader.vue'
import StatusMark from '@/shared/components/StatusMark.vue'
import { useConnectionStore } from '@/stores/connection'

const route = useRoute()
const connection = useConnectionStore()
const modules = computed(() => connection.capabilities?.modules ?? [])
const selected = computed(() =>
  modules.value.find(module => module.key === String(route.params.key ?? '')),
)
</script>

<template>
  <div class="dc-page modules-page">
    <PageHeader
      title="服务模块"
      description="以 Worker 运行时能力为准，不依赖 Pages 编译期静态列表"
    />
    <div v-if="!connection.capabilities" class="dc-empty dc-panel">
      <NResult status="info" title="尚未取得运行时能力" description="请先连接服务器。">
        <template #footer><NButton @click="$router.push('/settings')">打开设置</NButton></template>
      </NResult>
    </div>
    <section v-else class="modules-page__layout dc-panel">
      <div class="modules-page__list">
        <RouterLink
          v-for="module in modules"
          :key="module.key"
          :to="`/modules/${module.key}`"
          class="modules-page__row"
          :class="{ 'modules-page__row--selected': selected?.key === module.key }"
        >
          <div>
            <strong>{{ module.name }}</strong
            ><small>{{ module.apiPrefix }}</small>
          </div>
          <StatusMark
            :label="module.runtime.available ? '可用' : '配置不完整'"
            :tone="module.runtime.available ? 'success' : 'warning'"
          />
        </RouterLink>
      </div>
      <article v-if="selected" class="modules-page__detail">
        <h2>{{ selected.name }}</h2>
        <p>{{ selected.description }}</p>
        <NDescriptions label-placement="left" :column="1" bordered size="small">
          <NDescriptionsItem label="API Prefix"
            ><code>{{ selected.apiPrefix }}</code></NDescriptionsItem
          >
          <NDescriptionsItem label="Cloudflare Bindings">
            {{ selected.cloudflareBindings.join(', ') || '无' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="Worker 环境变量">
            {{ selected.workerEnvVars.join(', ') || '无' }}
          </NDescriptionsItem>
        </NDescriptions>
      </article>
      <div v-else class="dc-empty">选择一个模块查看运行配置</div>
    </section>
  </div>
</template>

<style scoped>
.modules-page {
  max-width: 1380px;
  margin: 0 auto;
}

.modules-page__layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.42fr) minmax(0, 0.58fr);
  min-height: 520px;
}

.modules-page__list {
  border-right: 1px solid var(--dc-border);
}

.modules-page__row {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--dc-border);
}

.modules-page__row:hover,
.modules-page__row--selected {
  background: var(--dc-blue-soft);
}

.modules-page__row div {
  display: grid;
  gap: 5px;
}

.modules-page__row strong {
  font-size: 13px;
}

.modules-page__row small {
  color: var(--dc-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
}

.modules-page__detail {
  padding: 28px;
}

.modules-page__detail h2 {
  margin: 0;
  font-size: 21px;
}

.modules-page__detail p {
  margin: 10px 0 24px;
  color: var(--dc-text-secondary);
  line-height: 1.7;
}

@media (max-width: 760px) {
  .modules-page__layout {
    grid-template-columns: 1fr;
  }

  .modules-page__list {
    border-right: 0;
    border-bottom: 1px solid var(--dc-border);
  }
}
</style>