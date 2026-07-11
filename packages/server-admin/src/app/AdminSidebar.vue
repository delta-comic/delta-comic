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
  @apply [position:fixed];
  @apply [z-index:30];
  @apply [top:0];
  @apply [bottom:0];
  @apply [left:0];
  @apply [display:flex];
  @apply [width:var(--dc-sidebar-width)];
  @apply [flex-direction:column];
  @apply [background:var(--dc-sidebar)];
  @apply [border-right:1px_solid_var(--dc-border)];
}

.admin-sidebar__brand {
  @apply [display:flex];
  @apply [height:var(--dc-header-height)];
  @apply [gap:10px];
  @apply [align-items:center];
  @apply [padding:0_20px];
  @apply [color:var(--dc-text)];
  @apply [font-size:15px];
  @apply [font-weight:680];
  @apply [background:transparent];
  @apply [border:0];
  @apply [cursor:pointer];
}

.admin-sidebar__mark {
  @apply [display:grid];
  @apply [width:28px];
  @apply [height:28px];
  @apply [color:#fff];
  @apply [font-size:17px];
  @apply [background:var(--dc-blue)];
  @apply [border-radius:5px];
  @apply [place-items:center];
}

.admin-sidebar__nav {
  @apply [display:grid];
  @apply [gap:4px];
  @apply [padding:20px_10px];
}

.admin-sidebar__item {
  @apply [position:relative];
  @apply [display:flex];
  @apply [min-height:44px];
  @apply [gap:14px];
  @apply [align-items:center];
  @apply [padding:0_14px];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:14px];
  @apply [text-align:left];
  @apply [background:transparent];
  @apply [border:0];
  @apply [border-radius:5px];
  @apply [cursor:pointer];
}

.admin-sidebar__item:hover {
  @apply [color:var(--dc-blue)];
  @apply [background:var(--dc-surface-soft)];
}

.admin-sidebar__item--selected {
  @apply [color:var(--dc-blue)];
  @apply [font-weight:630];
  @apply [background:var(--dc-blue-soft)];
}

.admin-sidebar__item--selected::before {
  @apply [position:absolute];
  @apply [top:8px];
  @apply [bottom:8px];
  @apply [left:-10px];
  @apply [width:3px];
  @apply [background:var(--dc-blue)];
  content: '';
}

.admin-sidebar__footer {
  @apply [display:flex];
  @apply [gap:9px];
  @apply [align-items:center];
  @apply [margin-top:auto];
  @apply [padding:18px_22px];
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:12px];
  @apply [border-top:1px_solid_var(--dc-border)];
}

.admin-sidebar__status-dot {
  @apply [width:8px];
  @apply [height:8px];
  @apply [background:var(--dc-green)];
  @apply [border-radius:1px];
}

.admin-sidebar__scrim {
  @apply [display:none];
}

@media (max-width: 860px) {
  .admin-sidebar {
    @apply [transform:translateX(-100%)];
    @apply [transition:transform_180ms_ease];
  }

  .admin-sidebar--open {
    @apply [transform:translateX(0)];
  }

  .admin-sidebar__scrim {
    @apply [position:fixed];
    @apply [z-index:20];
    @apply [inset:0];
    @apply [display:block];
    @apply [background:rgb(20_29_43_/_35%)];
    @apply [border:0];
  }
}
</style>