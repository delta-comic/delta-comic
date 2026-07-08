<script setup lang="ts">
import { serverModules } from '@delta-comic/server-config'
import { useRouter } from 'vue-router'

const router = useRouter()
const go = (path: string) => router.push(path)

const menuOptions = [
  { label: '概览', key: '/', path: '/' },
  ...serverModules
    .filter(module => module.key != 'health')
    .map(module => ({ label: module.name, key: module.adminRoute, path: module.adminRoute })),
]
</script>

<template>
  <NLayout class="min-h-screen">
    <NLayoutHeader bordered class="px-6 py-4">
      <NSpace justify="space-between" align="center">
        <NText strong>Delta Comic Server</NText>
        <NTag type="success">Cloudflare Pages</NTag>
      </NSpace>
    </NLayoutHeader>
    <NLayout has-sider>
      <NLayoutSider
        bordered
        collapse-mode="width"
        :collapsed-width="0"
        :width="240"
        show-trigger="bar"
      >
        <NMenu :options="menuOptions" :value="$route.path" @update:value="go" />
      </NLayoutSider>
      <NLayoutContent class="p-6">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>