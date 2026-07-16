<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

import AppNavigationItem from './AppNavigationItem.vue'

defineProps<{ active: string }>()
defineEmits<{ create: [] }>()
const { t } = useI18n()

const items = computed<
  Array<{ className: string; icon: Component; key: string; label: string; to: string }>
>(() => [
  {
    className: 'col-start-1 desktop:row-start-2',
    icon: Icons.other.HomeTab,
    key: 'home',
    label: t('navigation.home'),
    to: '/main/home',
  },
  {
    className: 'col-start-2 desktop:row-start-3',
    icon: Icons.other.SubscribeTab,
    key: 'subscribe',
    label: t('navigation.subscribe'),
    to: '/main/subscribe',
  },
  {
    className: 'col-start-4 desktop:row-start-5',
    icon: Icons.material.ShoppingBagOutlined,
    key: 'plugin',
    label: t('navigation.plugin'),
    to: '/main/plugin',
  },
  {
    className: 'col-start-5 desktop:row-start-6',
    icon: Icons.other.UserTab,
    key: 'user',
    label: t('navigation.user'),
    to: '/main/user',
  },
])
</script>

<template>
  <nav
    class="app-navigation fixed inset-x-0 bottom-0 z-100 grid h-[calc(var(--dc-navigation-height)+var(--safe-area-inset-bottom))] grid-cols-5 items-center border-t border-dc-border bg-[color-mix(in_srgb,var(--dc-surface)_94%,transparent)] [padding:5px_max(8px,var(--safe-area-inset-right))_var(--safe-area-inset-bottom)_max(8px,var(--safe-area-inset-left))] [box-shadow:0_-8px_30px_rgb(0_0_0/8%)] [backdrop-filter:blur(22px)_saturate(140%)] desktop:relative desktop:h-full desktop:w-(--dc-desktop-navigation-width) desktop:grid-cols-1 desktop:grid-rows-[64px_repeat(2,64px)_72px_repeat(2,64px)_1fr] desktop:border-t-0 desktop:border-r desktop:px-2.5 desktop:py-3"
    :aria-label="t('navigation.aria.main')"
  >
    <div
      class="mx-auto hidden size-11 place-items-center rounded-[15px] bg-dc-primary text-2xl font-extrabold text-white desktop:grid"
      aria-hidden="true"
    >
      Δ
    </div>
    <AppNavigationItem
      v-for="item in items"
      :key="item.key"
      :active="active === item.key"
      :icon="item.icon"
      :label="item.label"
      :to="item.to"
      :class="item.className"
    />
    <button
      class="app-navigation__create col-start-3 row-start-1 mx-auto -mt-2.5 grid size-[58px] cursor-pointer place-items-center rounded-[21px] border-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--p-color)_84%,white),var(--p-color))] p-0 text-white [box-shadow:0_10px_24px_color-mix(in_srgb,var(--p-color)_32%,transparent),inset_0_1px_0_rgb(255_255_255/28%)] [transition:transform_160ms_ease,filter_160ms_ease] hover:brightness-[1.04] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-dc-primary active:scale-[0.94] desktop:col-start-1 desktop:row-start-4 desktop:m-auto desktop:size-13 desktop:rounded-[18px]"
      type="button"
      :aria-label="t('navigation.aria.createFork')"
      @click="$emit('create')"
    >
      <NIcon size="36"><Icons.material.PlusFilled /></NIcon>
    </button>
  </nav>
</template>