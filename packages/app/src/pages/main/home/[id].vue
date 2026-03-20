<script setup lang="ts">
import { Global } from '@delta-comic/plugin'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const $route = useRoute<'/main/home/[id]'>()
const plugin = computed(() => $route.query.plugin?.toString() ?? '')
const id = computed(() => $route.params.id)
const tabbar = computed(
  () => Global.tabbar.get(plugin.value)?.find(v => v.id == id.value)!
)
</script>

<template>
  <component isActive :tabbar :is="tabbar.comp" />
</template>