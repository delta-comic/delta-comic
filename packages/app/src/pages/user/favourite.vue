<script setup lang="ts">
import FavouriteOverview from '@/components/user/favourite/FavouriteOverview.vue'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <FavouriteOverview v-else />
  </RouterView>
</template>