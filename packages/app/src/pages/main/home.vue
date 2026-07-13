<script setup lang="ts">
import { Global } from '@delta-comic/plugin'
import { shallowRef, provide, nextTick, useTemplateRef, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import userIcon from '@/assets/images/userIcon.webp'
import ExtendableSearchBar from '@/components/home/mainPageSearchBar.vue'
import { Icons } from '@/icons'
import { useAppStore } from '@/stores/app'
import { isShowMainHomeNavBar } from '@/symbol'
const $router = useRouter()
const { t } = useI18n()
const isShowNavBar = shallowRef(true)
provide(isShowMainHomeNavBar, isShowNavBar)

definePage({ redirect: { name: '/main/home/random' } })

const extendableSearchBar = useTemplateRef('extendableSearchBar')

const toSearchInHideMode = async () => {
  isShowNavBar.value = true
  await nextTick()
  extendableSearchBar.value?.inputEl?.focus()
}

const app = useAppStore()

const tabItem = computed(() =>
  Array.from(Global.tabbar.entries()).flatMap(pair =>
    pair[1].map(val => ({ title: val.title, name: val.id, queries: { plugin: pair[0] } })),
  ),
)
const tabs = computed(() => [
  {
    title: t('home.tabs.recommended'),
    name: 'random',
    route: { name: '/main/home/random' as const },
  },
  { title: t('home.tabs.hot'), name: 'hot', route: { name: '/main/home/hot' as const } },
  ...tabItem.value.map(
    v =>
      ({
        ...v,
        route: { name: '/main/home/[id]', params: { id: v.name }, query: v.queries },
      }) as const,
  ),
])
</script>

<template>
  <div class="w-full bg-(--dc-surface) pt-safe"></div>
  <header
    :class="[
      isShowNavBar ? 'translate-y-0' : '-translate-y-[calc(var(--safe-area-inset-top)+100%)]',
    ]"
    class="relative flex h-13.5 w-full items-center overflow-hidden bg-(--dc-surface) transition-transform duration-200 *:overflow-hidden"
  >
    <div class="ml-1 size-10.25!">
      <Teleport to="#popups">
        <DcImage
          :src="app.activatedUser?.avatar ?? userIcon"
          :fallback="userIcon"
          round
          v-if="!extendableSearchBar?.isSearching"
          :class="[isShowNavBar ? 'translate-y-0' : '-translate-y-[200%]']"
          class="fixed top-safe-offset-2 ml-1 size-10.25! transition-transform duration-200"
        />
      </Teleport>
    </div>
    <ExtendableSearchBar ref="extendableSearchBar" />
    <div
      class="ml-auto flex shrink-0 items-center gap-3 px-3"
      v-if="!extendableSearchBar?.isSearching"
    >
      <button
        type="button"
        class="dc-interactive rounded-full p-1"
        :aria-label="t('home.actions.openGame')"
        @click="$router.force.push({ name: '/' })"
      >
        <NIcon color="rgb(156 163 175)" size="1.8rem">
          <Icons.material.VideogameAssetFilled />
        </NIcon>
      </button>
      <NIcon color="rgb(156 163 175)" size="1.8rem" :aria-label="t('home.announcement')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 10v4a2 2 0 0 0 2 2h1l2 4h2l-1.5-4H11l7 3V5l-7 3H5a2 2 0 0 0-2 2Zm17-2.5v9a3 3 0 0 0 0-9Z"
          />
        </svg>
      </NIcon>
    </div>
  </header>
  <div
    class="static h-(--dc-tabs-height) transition-transform duration-200"
    :class="[
      isShowNavBar
        ? 'translate-y-0'
        : '-translate-y-[calc(var(--dc-tabs-height)+var(--dc-tabs-padding-bottom))]',
    ]"
  >
    <DcTab :items="tabs" />
    <button
      type="button"
      :aria-label="t('search.actions.expand')"
      @click="toSearchInHideMode"
      class="dc-interactive absolute! top-1/2 right-0 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-(--dc-surface) p-1 text-(--dc-text-secondary) shadow transition-transform duration-200"
      :class="[isShowNavBar ? 'translate-x-full' : '-translate-x-2']"
    >
      <NIcon size="25">
        <Icons.material.SearchFilled />
      </NIcon>
    </button>
    <button
      type="button"
      :aria-label="t('category.openAll')"
      :class="[isShowNavBar ? 'translate-x-full' : '-translate-x-2']"
      class="dc-interactive absolute! top-1/2 right-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-(--dc-surface) p-1 text-(--dc-text-secondary) shadow transition-transform duration-200"
      @click="$router.force.push({ name: '/cate' })"
    >
      <NIcon size="25">
        <Icons.material.MoreHorizRound />
      </NIcon>
    </button>
  </div>
  <div
    class="min-h-screen w-full overflow-hidden transition-all duration-200"
    :class="[
      isShowNavBar
        ? 'h-[calc(100%-var(--dc-tabs-height)-var(--dc-tabs-height)-var(--dc-tabs-padding-bottom)-var(--safe-area-inset-top))] translate-y-0'
        : 'h-[calc(100%-var(--safe-area-inset-top)-var(--dc-tabs-height))]! -translate-y-[calc(var(--dc-tabs-height)+var(--dc-tabs-padding-bottom))]',
    ]"
  >
    <RouterView />
  </div>
</template>