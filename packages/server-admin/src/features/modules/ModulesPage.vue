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
  @apply [max-width:1380px];
  @apply [margin:0_auto];
}

.modules-page__layout {
  @apply [display:grid];
  @apply [grid-template-columns:minmax(280px,_0.42fr)_minmax(0,_0.58fr)];
  @apply [min-height:520px];
}

.modules-page__list {
  @apply [border-right:1px_solid_var(--dc-border)];
}

.modules-page__row {
  @apply [display:flex];
  @apply [gap:20px];
  @apply [align-items:center];
  @apply [justify-content:space-between];
  @apply [padding:16px_18px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.modules-page__row:hover,
.modules-page__row--selected {
  @apply [background:var(--dc-blue-soft)];
}

.modules-page__row div {
  @apply [display:grid];
  @apply [gap:5px];
}

.modules-page__row strong {
  @apply [font-size:13px];
}

.modules-page__row small {
  @apply [color:var(--dc-text-muted)];
  @apply [font-family:ui-monospace,_SFMono-Regular,_Menlo,_monospace];
  @apply [font-size:10px];
}

.modules-page__detail {
  @apply [padding:28px];
}

.modules-page__detail h2 {
  @apply [margin:0];
  @apply [font-size:21px];
}

.modules-page__detail p {
  @apply [margin:10px_0_24px];
  @apply [color:var(--dc-text-secondary)];
  @apply [line-height:1.7];
}

@media (max-width: 760px) {
  .modules-page__layout {
    @apply [grid-template-columns:1fr];
  }

  .modules-page__list {
    @apply [border-right:0];
    @apply [border-bottom:1px_solid_var(--dc-border)];
  }
}
</style>