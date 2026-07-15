<script setup lang="ts">
import { FavouriteDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { DcState } from '@delta-comic/ui'
import { isEmpty } from 'es-toolkit/compat'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const props = withDefaults(defineProps<{ isCardMode?: boolean; card: FavouriteDB.Card }>(), {
  isCardMode: true,
})
const emit = defineEmits<{ open: []; play: [] }>()
const { t } = useI18n()

const { state: favouriteItems } = FavouriteDB.useQueryItem(
  db =>
    db
      .where('belongTo', '=', props.card.createAt)
      .innerJoin('itemStore', 'favouriteItem.itemKey', 'itemStore.key')
      .selectAll()
      .orderBy('addTime', 'desc')
      .execute(),
  [() => props.card.createAt],
  () => [],
)
</script>

<template>
  <DcState :state="favouriteItems" v-slot="{ data: items }" class="w-full" content-class="w-full">
    <button
      v-if="isCardMode"
      type="button"
      class="active:bg-gray dc-interactive relative flex w-full flex-col items-center overflow-hidden rounded-xl border-none bg-(--dc-surface) bg-center p-3 text-left text-(--dc-text)"
      :aria-label="t('favourite.actions.openFolder', { title: card.title })"
      @click="emit('open')"
    >
      <div class="relative flex h-6 w-full items-center">
        <div class="text-lg font-semibold">{{ card.title }}</div>
        <div class="absolute right-1 flex items-center text-[13px] text-(--dc-text-secondary)">
          <template v-if="card.private">
            <NIcon size="16px">
              <Icons.antd.LockOutlined />
            </NIcon>
            <span class="mx-1">·</span>
          </template>
          {{ t('common.units.contentCount', { count: items.length }) }}
          <NIcon size="15px">
            <Icons.material.ArrowForwardIosRound />
          </NIcon>
        </div>
      </div>
      <div class="mt-3 flex w-full justify-around">
        <NEmpty
          v-if="isEmpty(items)"
          :description="t('common.status.noResults')"
          class="w-full justify-center!"
        />
        <template v-else>
          <div
            v-for="{ item, itemKey } of items.slice(0, 3)"
            :key="itemKey"
            class="flex w-[30%] flex-col gap-2"
          >
            <DcImage
              :src="uni.image.Image.create(item.cover)"
              class="z-2 aspect-3/4 rounded-lg!"
              fit="cover"
            />
            <div class="dc-clamp-2">{{ item.title }}</div>
          </div>
        </template>
      </div>
    </button>

    <article
      v-else
      class="active:bg-gray relative flex min-h-29 w-full items-center gap-3 overflow-hidden rounded-xl border-none bg-(--dc-surface) p-3 text-(--dc-text)"
    >
      <button
        type="button"
        class="dc-interactive absolute inset-0 z-0 border-0 bg-transparent"
        :aria-label="t('favourite.actions.openFolder', { title: card.title })"
        @click="emit('open')"
      />

      <div
        class="pointer-events-none relative z-1 flex h-24 w-[40%] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--dc-background)"
      >
        <DcImage
          v-if="items[0]"
          :src="uni.image.Image.create(items[0].item.cover)"
          class="size-full! rounded-lg!"
          fit="cover"
        />
        <NIcon v-else size="2.5rem" color="var(--dc-text-secondary)">
          <Icons.antd.FolderOutlined />
        </NIcon>
      </div>

      <div class="pointer-events-none relative z-1 flex min-w-0 flex-1 flex-col self-stretch py-1">
        <div class="truncate text-lg font-semibold">{{ card.title }}</div>
        <div class="mt-auto flex items-center text-sm text-(--dc-text-secondary)">
          <template v-if="card.private">
            <NIcon size="16px">
              <Icons.antd.LockOutlined />
            </NIcon>
            <span class="mx-1">·</span>
          </template>
          {{ t('common.units.contentCount', { count: items.length }) }}
        </div>
      </div>

      <NButton
        class="relative z-2 shrink-0"
        quaternary
        round
        size="small"
        :aria-label="t('favourite.actions.playFolder', { title: card.title })"
        @click="emit('play')"
      >
        <template #icon>
          <NIcon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </NIcon>
        </template>
        {{ t('favourite.actions.play') }}
      </NButton>
    </article>
  </DcState>
</template>