<script setup lang="ts">
import { RouterView } from 'vue-router'

import FavouriteOverview from '@/components/user/favourite/FavouriteOverview'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <FavouriteOverview v-else />
  </RouterView>
</template>