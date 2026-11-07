<script setup lang="ts">
import { appNavigation } from '@delta-comic/client-app-core/clientHost'
import { Icons } from '@delta-comic/client-app-core/icons'
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import AppNavigationItem from './AppNavigationItem.vue'

defineProps<{ active: string }>()
defineEmits<{ create: [] }>()
const { t } = useI18n()

const items = computed<
  Array<{ className: string; icon?: Component; key: string; label: string; to: string }>
>(() => [
  {
    className: 'col-start-1 ',
    icon: Icons.other.HomeTab,
    key: 'home',
    label: t('navigation.home'),
    to: '/main/home',
  },
  {
    className: 'col-start-2 ',
    icon: Icons.other.SubscribeTab,
    key: 'subscribe',
    label: t('navigation.subscribe'),
    to: '/main/subscribe',
  },
  {
    className: 'col-start-4 ',
    icon: Icons.material.ShoppingBagOutlined,
    key: 'plugin',
    label: t('navigation.plugin'),
    to: '/main/plugin',
  },
  {
    className: 'col-start-5 ',
    icon: Icons.other.UserTab,
    key: 'user',
    label: t('navigation.user'),
    to: '/main/user',
  },
  ...appNavigation
    .filter(({ item }) => item.navigation)
    .map(({ item, owner }) => ({
      className: 'col-start-1 ',
      icon: item.icon,
      key: `${owner}:${item.path}`,
      label: item.title,
      to: item.path,
    })),
])
</script>

<template>
  <nav
    class="app-navigation fixed inset-x-0 bottom-0 z-100 grid h-[calc(var(--dc-navigation-height)+var(--safe-area-inset-bottom))] grid-cols-5 items-center border-t border-dc-border bg-[color-mix(in_srgb,var(--dc-surface)_94%,transparent)] p-[5px_max(8px,var(--safe-area-inset-right))_var(--safe-area-inset-bottom)_max(8px,var(--safe-area-inset-left))] [box-shadow:0_-8px_30px_rgb(0_0_0/8%)] [backdrop-filter:blur(22px)_saturate(140%)]"
    :aria-label="t('navigation.aria.main')"
  >
    <AppNavigationItem
      v-for="item in items"
      :key="item.key"
      :active="active === item.key || active === item.to || active.startsWith(`${item.to}/`)"
      :icon="item.icon"
      :label="item.label"
      :to="item.to"
      :class="item.className"
    />
    <button
      class="app-navigation__create col-start-3 row-start-1 mx-auto -mt-2.5 grid size-14.5 cursor-pointer place-items-center rounded-[21px] border-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--p-color)_84%,white),var(--p-color))] p-0 text-white [box-shadow:0_10px_24px_color-mix(in_srgb,var(--p-color)_32%,transparent),inset_0_1px_0_rgb(255_255_255/28%)] [transition:transform_160ms_ease,filter_160ms_ease] hover:brightness-[1.04] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-dc-primary active:scale-[0.94]"
      type="button"
      :aria-label="t('navigation.aria.createFork')"
      @click="$emit('create')"
    >
      <NIcon size="36"><Icons.material.PlusFilled /></NIcon>
    </button>
  </nav>
</template>