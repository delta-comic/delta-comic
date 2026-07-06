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
  <n-layout class="min-h-screen">
    <n-layout-header bordered class="px-6 py-4">
      <n-space justify="space-between" align="center">
        <n-text strong>Delta Comic Server</n-text>
        <n-tag type="success">Cloudflare Pages</n-tag>
      </n-space>
    </n-layout-header>
    <n-layout has-sider>
      <n-layout-sider bordered collapse-mode="width" :collapsed-width="0" :width="240" show-trigger="bar">
        <n-menu :options="menuOptions" :value="$route.path" @update:value="go" />
      </n-layout-sider>
      <n-layout-content class="p-6">
        <RouterView />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>
