<script setup lang="ts">
import { usePluginStore } from '@delta-comic/plugin'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const $route = useRoute<'/user/action/[plugin]/[key]'>()
const plugin = $route.params.plugin
const key = $route.params.key
const pluginStore = usePluginStore()
const item = computed(
  () =>
    pluginStore.plugins
      .get(plugin)
      ?.user?.userActionPages?.map(v => v.items.find(item => item.key == key)!)[0]
)
</script>

<template>
  <VanNavBar
    left-arrow
    @click-left="$router.back()"
    :title="item?.name ?? plugin"
    class="pt-safe"
  />
  <div class="h-[calc(100%-46px-var(--safe-area-inset-top))]! w-full">
    <component v-if="item?.type == 'button'" :is="item.page" />
  </div>
</template>