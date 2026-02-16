<script setup lang="ts">
import ExtendableSearchBar from '@/components/home/mainPageSearchBar.vue'
import userIcon from '@/assets/images/userIcon.webp'
import { isShowMainHomeNavBar } from '@/symbol'
import { VideogameAssetFilled } from '@vicons/material'
import { isEmpty, random } from 'es-toolkit/compat'
import { shallowRef, provide, nextTick, useTemplateRef, computed } from 'vue'
import { useRouter } from 'vue-router'
import { uni } from '@delta-comic/model'
import { Global } from '@delta-comic/plugin'
import { DcImage, DcRouterTab, DcVar } from '@delta-comic/ui'
const $router = useRouter()
const isShowNavBar = shallowRef(true)
provide(isShowMainHomeNavBar, isShowNavBar)

definePage({ redirect: { name: '/main/home/random' } })

const extendableSearchBar = useTemplateRef('extendableSearchBar')

const toSearchInHideMode = async () => {
  isShowNavBar.value = true
  await nextTick()
  extendableSearchBar.value?.inputEl?.focus()
}

const avatars = computed(() =>
  Array.from(uni.user.User.userBase.values())
    .filter(v => !!v.avatar)
    .map(v => v.avatar!)
)

const tabItem = computed(() =>
  Array.from(Global.tabbar.entries()).flatMap(pair =>
    pair[1].map(val => ({ title: val.title, name: val.id, queries: { plugin: pair[0] } }))
  )
)
</script>

<template>
  <div class="w-full bg-(--van-background-2) pt-safe"></div>
  <header
    :class="[
      isShowNavBar ? 'translate-y-0' : '-translate-y-[calc(var(--safe-area-inset-top)+100%)]'
    ]"
    class="relative flex h-13.5 w-full items-center overflow-hidden bg-(--van-background-2) transition-transform duration-200 *:overflow-hidden"
  >
    <div class="ml-1 size-10.25!">
      <DcVar
        :value="isEmpty(avatars) ? userIcon : avatars[random(0, avatars.length - 1)]"
        v-slot="{ value: src }"
      >
        <Teleport to="#popups">
          <DcImage
            :src
            round
            v-if="!extendableSearchBar?.isSearching"
            :class="[isShowNavBar ? 'translate-y-0' : '-translate-y-[200%]']"
            class="fixed top-safe-offset-2 ml-1 size-10.25! transition-transform duration-200"
          />
        </Teleport>
      </DcVar>
    </div>
    <ExtendableSearchBar ref="extendableSearchBar" />
    <div
      class="flex w-[calc(50%-63px)] justify-evenly font-mono"
      v-if="!extendableSearchBar?.isSearching"
    >
      <NIcon color="rgb(156 163 175)" @click="$router.force.push({ name: '/' })" size="1.8rem">
        <VideogameAssetFilled />
      </NIcon>
      <VanIcon name="bullhorn-o" color="rgb(156 163 175)" size="1.8rem" />
    </div>
  </header>
  <div
    class="static h-(--van-tabs-line-height) transition-transform duration-200"
    :class="[
      isShowNavBar
        ? 'translate-y-0'
        : '-translate-y-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom))]'
    ]"
  >
    <DcRouterTab
      router-base="/main/home"
      :items="[{ title: '推荐', name: 'random' }, { title: '热门', name: 'hot' }, ...tabItem]"
    />
    <VanIcon
      name="search"
      @click="toSearchInHideMode"
      size="25px"
      color="var(--van-text-color-2)"
      class="absolute! top-1/2 right-0 -translate-y-1/2 rounded-full bg-(--van-background-2) p-1 shadow transition-transform duration-200"
      :class="[isShowNavBar ? 'translate-x-full' : '-translate-x-2']"
    />
    <VanIcon
      size="25px"
      color="var(--van-text-color-2)"
      :class="[isShowNavBar ? 'translate-x-full' : '-translate-x-2']"
      class="absolute! top-1/2 right-10 aspect-square -translate-y-1/2 rounded-full bg-(--van-background-2) p-1 shadow transition-transform duration-200"
      @click="$router.force.push({ name: '/cate' })"
      name="more-o"
    >
    </VanIcon>
  </div>
  <div
    class="w-full overflow-hidden transition-all duration-200"
    :class="[
      isShowNavBar
        ? 'h-[calc(100%-var(--van-tabs-line-height)-var(--van-tabs-line-height)-var(--van-tabs-padding-bottom)-var(--safe-area-inset-top))] translate-y-0'
        : 'h-[calc(100%-var(--safe-area-inset-top)-var(--van-tabs-line-height))]! -translate-y-[calc(var(--van-tabs-line-height)+var(--van-tabs-padding-bottom))]'
    ]"
  >
    <RouterView />
  </div>
</template>