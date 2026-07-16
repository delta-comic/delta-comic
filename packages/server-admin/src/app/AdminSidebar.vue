<script setup lang="ts">
import AppIcon from '@/shared/components/AppIcon.vue'

import type { AdminFeatureNavigation } from './featureRegistry'

defineProps<{ items: AdminFeatureNavigation[]; open: boolean; selectedPath: string }>()

const emit = defineEmits<{ close: []; navigate: [path: string] }>()
</script>

<template>
  <aside
    class="admin-sidebar w-sidebar border-border bg-navigation fixed inset-y-0 left-0 z-30 flex flex-col border-r transition-transform duration-180 ease-out max-[860px]:transition-transform"
    :class="[
      open ? 'admin-sidebar--open max-[860px]:translate-x-0' : 'max-[860px]:-translate-x-full',
    ]"
  >
    <button
      class="admin-sidebar__brand h-header text-foreground flex cursor-pointer items-center gap-2.5 border-0 bg-transparent px-5 text-[15px] font-[680]"
      type="button"
      @click="emit('navigate', '/')"
    >
      <span
        class="admin-sidebar__mark rounded-panel bg-brand grid size-7 place-items-center text-[17px] text-white"
        aria-hidden="true"
        >Δ</span
      >
      <span>Delta Comic Server</span>
    </button>

    <nav class="admin-sidebar__nav grid gap-1 px-2.5 py-5" aria-label="管理功能">
      <button
        v-for="item in items"
        :key="item.path"
        class="admin-sidebar__item rounded-panel text-foreground-secondary hover:bg-surface-muted hover:text-brand relative flex min-h-11 cursor-pointer items-center gap-3.5 border-0 bg-transparent px-3.5 text-left text-sm before:absolute before:inset-y-2 before:-left-2.5 before:w-[3px] before:content-['']"
        :class="[
          selectedPath === item.path &&
            'admin-sidebar__item--selected bg-brand-soft text-brand before:bg-brand font-[630]',
        ]"
        type="button"
        @click="emit('navigate', item.path)"
      >
        <AppIcon :name="item.icon" :size="20" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div
      class="admin-sidebar__footer border-border text-muted-foreground mt-auto flex items-center gap-2.5 border-t px-[22px] py-[18px] text-xs"
    >
      <span
        class="admin-sidebar__status-dot bg-success size-2 rounded-[1px]"
        aria-hidden="true"
      ></span>
      <span>Worker 控制面</span>
    </div>
  </aside>
  <button
    v-if="open"
    class="admin-sidebar__scrim fixed inset-0 z-20 hidden border-0 bg-[rgb(20_29_43/35%)] max-[860px]:block"
    type="button"
    aria-label="关闭导航"
    @click="emit('close')"
  ></button>
</template>