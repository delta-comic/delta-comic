<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { db, DBUtils } from '@/db'
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { shallowRef } from 'vue'

defineProps<{ actions: { title: string; icon: Component; onClick: () => any }[] }>()

const isShowMenu = shallowRef(false)

const closeMenuBefore = (v: any) => {
  isShowMenu.value = false
  return v
}
const totalCount = computedAsync(
  () => DBUtils.countDb(db.value.selectFrom('plugin').where('enable', '=', true)),
  0
)
</script>

<template>
  <NFloatButton
    :right="10"
    :bottom="10"
    class="z-100000!"
    type="primary"
    shape="circle"
    menu-trigger="click"
    v-model:show-menu="isShowMenu"
  >
    <NIcon :size="25">
      <CheckRound />
    </NIcon>
    <template #menu>
      <template v-if="totalCount">
        <NPopover
          trigger="manual"
          :show="isShowMenu"
          placement="left-end"
          v-for="action of actions"
        >
          <template #trigger>
            <NFloatButton class="z-100000!" @click="closeMenuBefore(action.onClick)">
              <NIcon :size="20">
                <component :is="action.icon" />
              </NIcon>
            </NFloatButton>
          </template>
          {{ action.title }}
        </NPopover>
      </template>
    </template>
  </NFloatButton>
</template>