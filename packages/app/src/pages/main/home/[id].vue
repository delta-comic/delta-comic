<script setup lang="ts">
import { usePluginStore } from '@delta-comic/plugin'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const $route = useRoute<'/main/home/[id]'>()
const plugin = computed(() => $route.query.plugin?.toString() ?? '')
const id = computed(() => $route.params.id)
const pluginStore = usePluginStore()
const tabbar = computed(() =>
  pluginStore.plugins
    .get(plugin.value)
    ?.model?.content?.promotes?.tabbar?.find(value => value.id === id.value),
)
</script>

<template>
  <component isActive :tabbar :is="tabbar.comp" v-if="tabbar" />
</template>