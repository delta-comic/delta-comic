<script setup lang='ts'>
import { uni } from 'delta-comic-core'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const $route = useRoute()
const plugin = computed(() => $route.query.plugin?.toString() ?? '')
const id = computed(() => $route.params.id?.toString())
const tabbar = computed(() => uni.content.ContentPage.tabbar.get(plugin.value)?.find(v => v.id == id.value)!)
</script>

<template>
  <component isActive :tabbar :is="tabbar.comp" />
</template>