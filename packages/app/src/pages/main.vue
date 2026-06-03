<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import { Icons } from '@/icons'
const route = useRoute<'/main'>()
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
  <div class="h-[calc(100%-var(--van-tabbar-height))] w-full overflow-hidden">
    <RouterView />
  </div>
  <VanTabbar
    class="fixed bottom-0 w-full items-center opacity-100 transition-opacity"
    :model-value="name"
  >
    <VanTabbarItem name="home" to="/main/home" icon="home-o">首页</VanTabbarItem>
    <VanTabbarItem name="subscribe" to="/main/subscribe">
      <template #icon>
        <NIcon>
          <Icons.other.SubscribeTab />
        </NIcon>
      </template>
      关注
    </VanTabbarItem>
    <NButton
      class="mx-3! size-10! rounded-2xl! **:text-2xl!"
      type="primary"
      @click="showForkSelect = true"
    >
      <template #icon>
        <Icons.other.ForkTab />
      </template>
    </NButton>
    <VanTabbarItem name="plugin" to="/main/plugin" icon="bag-o">插件</VanTabbarItem>
    <VanTabbarItem name="user" to="/main/user" icon="user-o">我的</VanTabbarItem>
  </VanTabbar>
  <ForkSelect v-model:show="showForkSelect" />
</template>