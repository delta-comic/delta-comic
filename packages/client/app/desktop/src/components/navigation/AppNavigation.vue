<script setup lang="ts">
import { appNavigation } from '@delta-comic/core/clientHost'
import { Icons } from '@delta-comic/core/icons'
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
    className: 'row-start-2',
    icon: Icons.other.HomeTab,
    key: 'home',
    label: t('navigation.home'),
    to: '/main/home',
  },
  {
    className: 'row-start-3',
    icon: Icons.other.SubscribeTab,
    key: 'subscribe',
    label: t('navigation.subscribe'),
    to: '/main/subscribe',
  },
  {
    className: 'row-start-5',
    icon: Icons.material.ShoppingBagOutlined,
    key: 'plugin',
    label: t('navigation.plugin'),
    to: '/main/plugin',
  },
  {
    className: 'row-start-6',
    icon: Icons.other.UserTab,
    key: 'user',
    label: t('navigation.user'),
    to: '/main/user',
  },
  ...appNavigation
    .filter(({ item }) => item.navigation)
    .map(({ item, owner }) => ({
      className: 'row-start-7',
      icon: item.icon,
      key: `${owner}:${item.path}`,
      label: item.title,
      to: item.path,
    })),
])
</script>

<template>
  <nav
    class="app-navigation grid h-full w-22 grid-cols-1 grid-rows-[64px_repeat(2,64px)_72px_repeat(2,64px)_1fr] items-center gap-1 border-r border-dc-border bg-dc-surface px-2.5 py-3"
    :aria-label="t('navigation.aria.main')"
  >
    <div
      class="mx-auto grid size-11 place-items-center rounded-[15px] bg-dc-primary text-2xl font-extrabold text-white"
      aria-hidden="true"
    >
      Δ
    </div>
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
      class="app-navigation__create col-start-1 row-start-4 m-auto grid size-13 cursor-pointer place-items-center rounded-[18px] border-0 bg-dc-primary p-0 text-white hover:brightness-110 active:scale-95"
      type="button"
      :aria-label="t('navigation.aria.createFork')"
      @click="$emit('create')"
    >
      <NIcon size="36"><Icons.material.PlusFilled /></NIcon>
    </button>
  </nav>
</template>