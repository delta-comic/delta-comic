<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const $route = useRoute<'/user/edit/[plugin]'>()
const plugin = $route.params.plugin.toString()
const editor = computed(() => uni.user.User.userEditorBase.get(plugin))
</script>

<template>
  <VanNavBar left-arrow @click-left="$router.back()" title="编辑" class="pt-safe" />
  <NScrollbar class="h-[calc(100%-46px)]! w-full">
    <component v-if="editor" :is="editor" />
  </NScrollbar>
</template>