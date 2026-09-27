<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useConnectionStore } from '@/stores/connection'

import AdminSidebar from './AdminSidebar.vue'
import AdminTopbar from './AdminTopbar.vue'
import { featureNavigation } from './featureRegistry'

const route = useRoute()
const router = useRouter()
const connection = useConnectionStore()
const navigationOpen = shallowRef(false)

const selectedPath = computed(() => {
  const matches = featureNavigation.filter(item =>
    item.path === '/' ? route.path === '/' : route.path.startsWith(item.path),
  )
  return matches.sort((left, right) => right.path.length - left.path.length)[0]?.path ?? ''
})

const navigate = async (path: string) => {
  navigationOpen.value = false
  await router.push(path)
}

onMounted(() => {
  if (connection.hasCredentials) void connection.connect()
})
</script>

<template>
  <div class="admin-shell bg-surface text-foreground relative h-full">
    <AdminSidebar
      :items="featureNavigation"
      :open="navigationOpen"
      :selected-path="selectedPath"
      @close="navigationOpen = false"
      @navigate="navigate"
    />
    <div
      class="admin-shell__workspace ml-sidebar max-h-full min-w-0 overflow-y-auto max-[860px]:ml-0"
    >
      <AdminTopbar
        :api-base-url="connection.apiBaseUrl"
        :connection-status="connection.status"
        @menu="navigationOpen = true"
        @open-settings="navigate('/settings')"
      />
      <main class="admin-shell__main min-w-0">
        <RouterView />
      </main>
    </div>
  </div>
</template>