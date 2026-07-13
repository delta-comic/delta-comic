<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

defineProps<{ active: string }>()
defineEmits<{ create: [] }>()
const { t } = useI18n()

const items = computed<Array<{ icon: Component; key: string; label: string; to: string }>>(() => [
  {
    icon: Icons.material.AutoAwesomeMosaicOutlined,
    key: 'home',
    label: t('navigation.home'),
    to: '/main/home',
  },
  {
    icon: Icons.other.SubscribeTab,
    key: 'subscribe',
    label: t('navigation.subscribe'),
    to: '/main/subscribe',
  },
  {
    icon: Icons.material.ShoppingBagOutlined,
    key: 'plugin',
    label: t('navigation.plugin'),
    to: '/main/plugin',
  },
  { icon: Icons.antd.UserOutlined, key: 'user', label: t('navigation.user'), to: '/main/user' },
])
</script>

<template>
  <nav class="app-navigation" :aria-label="t('navigation.aria.main')">
    <div class="app-navigation__brand" aria-hidden="true">Δ</div>
    <RouterLink
      v-for="item in items.slice(0, 2)"
      :key="item.key"
      :class="{ 'app-navigation__item--active': active === item.key }"
      :to="item.to"
      class="app-navigation__item"
    >
      <NIcon size="22"><component :is="item.icon" /></NIcon>
      <span>{{ item.label }}</span>
    </RouterLink>
    <NButton
      class="app-navigation__create"
      type="primary"
      circle
      :aria-label="t('navigation.aria.createFork')"
      @click="$emit('create')"
    >
      <template #icon><Icons.other.ForkTab /></template>
    </NButton>
    <RouterLink
      v-for="item in items.slice(2)"
      :key="item.key"
      :class="{ 'app-navigation__item--active': active === item.key }"
      :to="item.to"
      class="app-navigation__item"
    >
      <NIcon size="22"><component :is="item.icon" /></NIcon>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-navigation {
  position: fixed;
  z-index: 100;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  height: calc(var(--dc-navigation-height) + var(--safe-area-inset-bottom));
  padding: 4px max(8px, var(--safe-area-inset-right)) var(--safe-area-inset-bottom)
    max(8px, var(--safe-area-inset-left));
  border-top: 1px solid var(--dc-border);
  background: color-mix(in srgb, var(--dc-surface) 90%, transparent);
  backdrop-filter: blur(18px);
}

.app-navigation__brand {
  display: none;
}

.app-navigation__item {
  display: flex;
  min-width: 0;
  height: 48px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 14px;
  color: var(--dc-text-secondary);
  font-size: 11px;
  text-decoration: none;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.app-navigation__item:hover,
.app-navigation__item--active {
  color: var(--p-color);
  background: color-mix(in srgb, var(--p-color) 10%, transparent);
}

.app-navigation__create {
  width: 44px;
  height: 44px;
  margin: auto;
  border-radius: 16px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--p-color) 30%, transparent);
}

@media (min-width: 960px) {
  .app-navigation {
    position: relative;
    grid-template-columns: 1fr;
    grid-template-rows: 64px repeat(2, 64px) 72px repeat(2, 64px) 1fr;
    width: var(--dc-desktop-navigation-width);
    height: 100%;
    padding: 12px 10px;
    border-top: 0;
    border-right: 1px solid var(--dc-border);
  }

  .app-navigation__brand {
    display: grid;
    width: 44px;
    height: 44px;
    margin: 0 auto;
    place-items: center;
    border-radius: 15px;
    background: var(--p-color);
    color: white;
    font-size: 24px;
    font-weight: 800;
  }

  .app-navigation__item {
    height: 58px;
    font-size: 12px;
  }
}
</style>