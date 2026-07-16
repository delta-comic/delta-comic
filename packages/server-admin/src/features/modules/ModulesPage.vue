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
  <div class="admin-page modules-page max-w-[1380px]">
    <PageHeader
      title="服务模块"
      description="以 Worker 运行时能力为准，不依赖 Pages 编译期静态列表"
    />
    <div v-if="!connection.capabilities" class="admin-empty admin-panel">
      <NResult status="info" title="尚未取得运行时能力" description="请先连接服务器。">
        <template #footer><NButton @click="$router.push('/settings')">打开设置</NButton></template>
      </NResult>
    </div>
    <section
      v-else
      class="modules-page__layout admin-panel grid min-h-[520px] grid-cols-[minmax(280px,0.42fr)_minmax(0,0.58fr)] max-[760px]:grid-cols-1"
    >
      <div
        class="modules-page__list border-border border-r max-[760px]:border-r-0 max-[760px]:border-b"
      >
        <RouterLink
          v-for="module in modules"
          :key="module.key"
          :to="`/modules/${module.key}`"
          class="modules-page__row border-border hover:bg-brand-soft flex items-center justify-between gap-5 border-b px-[18px] py-4"
          :class="[selected?.key === module.key && 'modules-page__row--selected bg-brand-soft']"
        >
          <div class="grid gap-[5px]">
            <strong class="text-[13px]">{{ module.name }}</strong
            ><small class="text-muted-foreground font-mono text-[10px]">{{
              module.apiPrefix
            }}</small>
          </div>
          <StatusMark
            :label="module.runtime.available ? '可用' : '配置不完整'"
            :tone="module.runtime.available ? 'success' : 'warning'"
          />
        </RouterLink>
      </div>
      <article v-if="selected" class="modules-page__detail p-7">
        <h2 class="m-0 text-[21px]">{{ selected.name }}</h2>
        <p class="text-foreground-secondary mt-2.5 mb-6 leading-[1.7]">
          {{ selected.description }}
        </p>
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
      <div v-else class="admin-empty">选择一个模块查看运行配置</div>
    </section>
  </div>
</template>