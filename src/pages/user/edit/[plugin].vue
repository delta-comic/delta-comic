<script setup lang='ts'>
import { uni } from 'delta-comic-core'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const $route = useRoute()
const plugin = $route.params.plugin.toString()
const editor = computed(() => uni.user.User.userEditorBase.get(plugin))
</script>

<template>
  <VanNavBar left-arrow @click-left="$router.back()" title="编辑"  class="pt-safe"/>
  <NScrollbar class="w-full !h-[calc(100%-46px)]">
    <component v-if="editor" :is="editor" />
  </NScrollbar>
</template>