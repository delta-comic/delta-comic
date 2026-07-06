<script setup lang="ts">
import { serverModules } from '@delta-comic/server-config'
import { computed } from 'vue'

import HealthPanel from '@/components/dashboard/HealthPanel.vue'
import ModuleOverview from '@/components/dashboard/ModuleOverview.vue'
import ServerEndpointForm from '@/components/dashboard/ServerEndpointForm.vue'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()
const healthUrl = computed(() => adminStore.isConfigured ? adminStore.endpoint(adminStore.healthPath) : '')
</script>

<template>
  <n-space vertical size="large">
    <n-card>
      <n-space vertical>
        <n-gradient-text type="primary" :size="28">Delta Comic Server Admin</n-gradient-text>
        <n-text>
          面板以 Cloudflare Pages 静态资源部署，Worker API、D1、secrets 仍保持在 server 包运行时中。
        </n-text>
      </n-space>
    </n-card>
    <ServerEndpointForm v-model="adminStore.apiBaseUrl" @save="adminStore.setApiBaseUrl" />
    <HealthPanel :health-url="healthUrl" :disabled="!adminStore.isConfigured" />
    <ModuleOverview :modules="serverModules" />
  </n-space>
</template>
