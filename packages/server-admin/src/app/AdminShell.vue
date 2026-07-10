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
  <div class="admin-shell">
    <AdminSidebar
      :items="featureNavigation"
      :open="navigationOpen"
      :selected-path="selectedPath"
      @close="navigationOpen = false"
      @navigate="navigate"
    />
    <div class="admin-shell__workspace">
      <AdminTopbar
        :api-base-url="connection.apiBaseUrl"
        :connection-status="connection.status"
        @menu="navigationOpen = true"
        @open-settings="navigate('/settings')"
      />
      <main class="admin-shell__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100%;
  background: var(--dc-surface);
}

.admin-shell__workspace {
  min-width: 0;
  min-height: 100vh;
  margin-left: var(--dc-sidebar-width);
}

.admin-shell__main {
  min-width: 0;
}

@media (max-width: 860px) {
  .admin-shell__workspace {
    margin-left: 0;
  }
}
</style>