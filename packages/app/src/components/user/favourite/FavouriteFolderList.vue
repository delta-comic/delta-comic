<script setup lang="ts">
import type { FavouriteDB } from '@delta-comic/db'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

import FavouriteCard from '../favouriteCard.vue'

defineProps<{ cards: FavouriteDB.Card[]; isCardMode: boolean }>()
const emit = defineEmits<{
  create: []
  open: [card: FavouriteDB.Card]
  play: [card: FavouriteDB.Card]
}>()
const { t } = useI18n()
</script>

<template>
  <div v-if="cards.length === 0" class="flex size-full flex-col items-center justify-center gap-4">
    <NEmpty :description="t('common.status.noResults')" />
    <NButton round secondary type="primary" size="small" @click="emit('create')">
      {{ t('favourite.actions.newFolder') }}
      <template #icon>
        <NIcon>
          <Icons.material.PlusFilled />
        </NIcon>
      </template>
    </NButton>
  </div>
  <div v-else class="favourite-folder-list">
    <FavouriteCard
      v-for="card in cards"
      :key="card.createAt"
      :card="card"
      :is-card-mode="isCardMode"
      @open="emit('open', card)"
      @play="emit('play', card)"
    />
  </div>
</template>

<style scoped>
.favourite-folder-list {
  display: grid;
  height: 100%;
  align-content: start;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
}
</style>