<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import AppNavigation from '@/components/navigation/AppNavigation.vue'
const route = useRoute<'/main'>()
const isStandalonePage = computed(() => route.name === '/main/search')
const name = computed(() => {
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
    class="size-full overflow-hidden desktop:grid"
    :class="{
      'desktop:grid-cols-1': isStandalonePage,
      'desktop:grid-cols-[var(--dc-desktop-navigation-width)_minmax(0,1fr)]': !isStandalonePage,
    }"
  >
    <AppNavigation v-if="!isStandalonePage" :active="name" @create="showForkSelect = true" />
    <main
      class="overflow-hidden desktop:h-full desktop:min-w-0 desktop:bg-dc-page desktop:[&>*]:mx-auto desktop:[&>*]:max-w-[1600px]"
      :class="
        isStandalonePage
          ? 'h-full'
          : 'h-[calc(100%-var(--dc-navigation-height)-var(--safe-area-inset-bottom))]'
      "
    >
      <RouterView />
    </main>
  </div>
  <ForkSelect v-model:show="showForkSelect" />
</template>