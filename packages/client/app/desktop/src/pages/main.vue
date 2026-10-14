<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import AppNavigation from '@/components/navigation/AppNavigation.vue'
const route = useRoute<'/main'>()
const isStandalonePage = computed(() => route.name === '/main/search')
const activeNavigation = computed(() => {
  if (route.path.startsWith('/plugins/')) return route.path
  switch (route.name) {
    case '/main/home':
    case '/main/home/[id]':
    case '/main/home/hot':
    case '/main/home/random':
      return 'home'
    case '/main/subscribe':
      return 'subscribe'
    case '/main/plugin':
    case '/main/plugin/config':
    case '/main/plugin/download':
    case '/main/plugin/list':
    case '/main/plugin/shop':
      return 'plugin'
    case '/main/user':
      return 'user'
  }
  return 'home'
})

const showForkSelect = shallowRef(false)
</script>

<template>
  <div
    class="grid size-full overflow-hidden"
    :class="{
      'grid-cols-1': isStandalonePage,
      'grid-cols-[88px_minmax(0,1fr)]': !isStandalonePage,
    }"
  >
    <AppNavigation
      v-if="!isStandalonePage"
      :active="activeNavigation"
      @create="showForkSelect = true"
    />
    <main class="h-full min-w-0 overflow-hidden bg-dc-page *:mx-auto *:max-w-[1600px]">
      <RouterView />
    </main>
  </div>
  <ForkSelect v-model:show="showForkSelect" />
</template>