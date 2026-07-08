<script setup lang="ts">
import { serverCollections, serverModules, type ServerModuleKey } from '@delta-comic/server-config'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const moduleKey = computed(() => route.params.key as ServerModuleKey)
const moduleInfo = computed(() => serverModules.find(item => item.key == moduleKey.value))
</script>

<template>
  <NCard v-if="moduleInfo" :title="moduleInfo.name">
    <NSpace vertical>
      <NText>{{ moduleInfo.description }}</NText>
      <NDescriptions bordered :column="1">
        <NDescriptionsItem label="API Prefix">{{ moduleInfo.apiPrefix }}</NDescriptionsItem>
        <NDescriptionsItem label="Cloudflare Bindings">
          {{ moduleInfo.cloudflareBindings.join(', ') || '无' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="Worker 环境变量">
          {{ moduleInfo.workerEnvVars.join(', ') || '无' }}
        </NDescriptionsItem>
      </NDescriptions>
      <NAlert v-if="moduleInfo.key == 'sync'" type="info" title="同步集合">
        {{ serverCollections.join(', ') }}；plugin 和 nativeStore 不参与云同步。
      </NAlert>
      <NAlert v-if="moduleInfo.key == 'auth'" type="warning" title="环境限制">
        Pages 面板不能读取 Worker secret。AUTH_PEPPER 与 TOKEN_PEPPER 只能通过 Wrangler/Cloudflare
        控制台配置。
      </NAlert>
    </NSpace>
  </NCard>
  <NResult
    v-else
    status="404"
    title="模块不存在"
    description="请从左侧菜单选择已注册的 server 模块。"
  />
</template>