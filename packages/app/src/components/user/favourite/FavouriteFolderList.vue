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
  <DcWaterfall
    v-else
    :key="isCardMode ? 'card' : 'list'"
    class="h-full!"
    un-reloadable
    :source="{ type: 'array', value: cards }"
    :col="1"
    :gap="8"
    :padding="8"
    v-slot="{ item }"
  >
    <FavouriteCard
      :card="item"
      :is-card-mode="isCardMode"
      @open="emit('open', item)"
      @play="emit('play', item)"
    />
  </DcWaterfall>
</template>