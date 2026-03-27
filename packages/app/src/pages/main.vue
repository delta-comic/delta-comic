<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute<'/main'>()
const name = computed(() => route.path.match(/(?<=\/main\/)\w+(?=\/)?/g)?.[0])

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 0 24 24"
          >
            <g
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 12c2.76 0 5-2.01 5-4.5S14.76 3 12 3v9z"></path>
              <path d="M12 12c0 2.76 2.01 5 4.5 5s4.5-2.24 4.5-5h-9z"></path>
              <path d="M12 12c-2.76 0-5 2.01-5 4.5S9.24 21 12 21v-9z"></path>
              <path d="M12 12c0-2.76-2.01-5-4.5-5S3 9.24 3 12h9z"></path>
            </g>
          </svg>
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
        <NIcon>
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px"
            y="0px"
            viewBox="0 0 512 512"
            enable-background="new 0 0 512 512"
            xml:space="preserve"
          >
            <path
              d="M352,96c-38.6,0-70,31.4-70,70c0,33.4,23.7,61.9,55.9,68.5c-1.2,19.1-10.3,29.3-27,42.2c-20.4,15.7-46.7,20-65.3,23.4
	c-40.7,7.4-62.9,27-72.5,40V170.8c15-2.8,28.7-10.5,39-21.9c11.6-12.9,18-29.5,18-46.9c0-38.6-31.4-70-70-70s-70,31.4-70,70
	c0,17,6.2,33.3,17.3,46.1c9.9,11.3,23.1,19.1,37.7,22.3v171.3c-14.5,3.2-27.8,11-37.7,22.3C96.2,376.7,90,393,90,410
	c0,38.6,31.4,70,70,70s70-31.4,70-70c0-23.4-11.6-44.9-30.7-57.9c8.6-9.7,24.5-19.6,51.1-24.4c21.6-3.9,52.6-9.6,77.4-28.8
	c23.6-18.2,36.7-36.5,38-64.3c32.3-6.5,56.1-35.1,56.1-68.6C422,127.4,390.6,96,352,96z M118,102c0-23.2,18.8-42,42-42
	s42,18.8,42,42s-18.8,42-42,42S118,125.2,118,102z M202,410c0,23.2-18.8,42-42,42s-42-18.8-42-42s18.8-42,42-42S202,386.8,202,410z
	 M352,208c-23.2,0-42-18.8-42-42s18.8-42,42-42c23.2,0,42,18.8,42,42S375.2,208,352,208z"
            ></path>
          </svg>
        </NIcon>
      </template>
    </NButton>
    <VanTabbarItem name="plugin" to="/main/plugin" icon="bag-o">插件</VanTabbarItem>
    <VanTabbarItem name="user" to="/main/user" icon="user-o">我的</VanTabbarItem>
  </VanTabbar>
  <ForkSelect v-model:show="showForkSelect" />
</template>