<script setup lang="ts">
import AppIcon from '@/shared/components/AppIcon.vue'

import type { AdminFeatureNavigation } from './featureRegistry'

defineProps<{ items: AdminFeatureNavigation[]; open: boolean; selectedPath: string }>()

const emit = defineEmits<{ close: []; navigate: [path: string] }>()
</script>

<template>
  <aside class="admin-sidebar" :class="{ 'admin-sidebar--open': open }">
    <button class="admin-sidebar__brand" type="button" @click="emit('navigate', '/')">
      <span class="admin-sidebar__mark" aria-hidden="true">Δ</span>
      <span>Delta Comic Server</span>
    </button>

    <nav class="admin-sidebar__nav" aria-label="管理功能">
      <button
        v-for="item in items"
        :key="item.path"
        class="admin-sidebar__item"
        :class="{ 'admin-sidebar__item--selected': selectedPath === item.path }"
        type="button"
        @click="emit('navigate', item.path)"
      >
        <AppIcon :name="item.icon" :size="20" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="admin-sidebar__footer">
      <span class="admin-sidebar__status-dot" aria-hidden="true"></span>
      <span>Worker 控制面</span>
    </div>
  </aside>
  <button
    v-if="open"
    class="admin-sidebar__scrim"
    type="button"
    aria-label="关闭导航"
    @click="emit('close')"
  ></button>
</template>

<style scoped>
.admin-sidebar {
  position: fixed;
  z-index: 30;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: var(--dc-sidebar-width);
  flex-direction: column;
  background: var(--dc-sidebar);
  border-right: 1px solid var(--dc-border);
}

.admin-sidebar__brand {
  display: flex;
  height: var(--dc-header-height);
  gap: 10px;
  align-items: center;
  padding: 0 20px;
  color: var(--dc-text);
  font-size: 15px;
  font-weight: 680;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.admin-sidebar__mark {
  display: grid;
  width: 28px;
  height: 28px;
  color: #fff;
  font-size: 17px;
  background: var(--dc-blue);
  border-radius: 5px;
  place-items: center;
}

.admin-sidebar__nav {
  display: grid;
  gap: 4px;
  padding: 20px 10px;
}

.admin-sidebar__item {
  position: relative;
  display: flex;
  min-height: 44px;
  gap: 14px;
  align-items: center;
  padding: 0 14px;
  color: #354052;
  font-size: 14px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}

.admin-sidebar__item:hover {
  color: var(--dc-blue);
  background: #f0f4fa;
}

.admin-sidebar__item--selected {
  color: var(--dc-blue);
  font-weight: 630;
  background: var(--dc-blue-soft);
}

.admin-sidebar__item--selected::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: -10px;
  width: 3px;
  background: var(--dc-blue);
  content: '';
}

.admin-sidebar__footer {
  display: flex;
  gap: 9px;
  align-items: center;
  margin-top: auto;
  padding: 18px 22px;
  color: var(--dc-text-muted);
  font-size: 12px;
  border-top: 1px solid var(--dc-border);
}

.admin-sidebar__status-dot {
  width: 8px;
  height: 8px;
  background: var(--dc-green);
  border-radius: 1px;
}

.admin-sidebar__scrim {
  display: none;
}

@media (max-width: 860px) {
  .admin-sidebar {
    transform: translateX(-100%);
    transition: transform 180ms ease;
  }

  .admin-sidebar--open {
    transform: translateX(0);
  }

  .admin-sidebar__scrim {
    position: fixed;
    z-index: 20;
    inset: 0;
    display: block;
    background: rgb(20 29 43 / 35%);
    border: 0;
  }
}
</style>