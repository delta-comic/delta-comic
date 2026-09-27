<script setup lang="ts">
import { usePluginStore } from '@delta-comic/plugin'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const $router = useRouter()
const $route = useRoute<'/user/action/[plugin]/[key]'>()
const plugin = computed(() => $route.params.plugin.toString())
const key = computed(() => $route.params.key.toString())
const pluginStore = usePluginStore()
const item = computed(() =>
  pluginStore.plugins
    .get(plugin.value)
    ?.model?.user?.userActionPages?.flatMap(page => page.items)
    .find(action => action.key == key.value),
)
</script>

<template>
  <div
    class="box-content flex h-(--dc-page-header-height) items-center bg-(--dc-surface) px-4 pt-safe"
  >
    <NPageHeader class="w-full" :title="item?.name ?? plugin" @back="$router.back()" />
  </div>
  <div class="h-[calc(100%-var(--dc-page-header-height)-var(--safe-area-inset-top))]! w-full">
    <component v-if="item?.type == 'button'" :is="item.page" />
  </div>
</template>