<script setup lang='ts'>
import { usePluginStore } from '@/plugin/store'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const $route = useRoute()
const plugin = $route.params.plugin.toString()
const key = $route.params.key.toString()
const pluginStore = usePluginStore()
const item = computed(() => pluginStore.plugins.get(plugin)?.user?.userActionPages?.map(v => v.items.find(item => item.key == key)!)[0])
</script>

<template>
  <VanNavBar left-arrow @click-left="$router.back()" :title="item?.name ?? plugin" class="pt-safe" />
  <div class="w-full h-[calc(100%-46px-var(--safe-area-inset-top))]!">
    <component v-if="item?.type == 'button'" :is="item.page" />
  </div>
</template>