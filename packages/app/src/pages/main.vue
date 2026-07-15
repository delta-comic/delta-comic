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
  <div class="main-layout" :class="{ 'main-layout--standalone': isStandalonePage }">
    <AppNavigation v-if="!isStandalonePage" :active="name" @create="showForkSelect = true" />
    <main class="main-layout__content">
      <RouterView />
    </main>
  </div>
  <ForkSelect v-model:show="showForkSelect" />
</template>

<style scoped>
.main-layout {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-layout__content {
  height: calc(100% - var(--dc-navigation-height) - var(--safe-area-inset-bottom));
  overflow: hidden;
}

.main-layout--standalone .main-layout__content {
  height: 100%;
}

@media (min-width: 960px) {
  .main-layout {
    display: grid;
    grid-template-columns: var(--dc-desktop-navigation-width) minmax(0, 1fr);
  }

  .main-layout--standalone {
    grid-template-columns: minmax(0, 1fr);
  }

  .main-layout__content {
    height: 100%;
    min-width: 0;
    background: var(--dc-background);
  }

  .main-layout__content > :deep(*) {
    max-width: 1600px;
    margin-inline: auto;
  }
}
</style>