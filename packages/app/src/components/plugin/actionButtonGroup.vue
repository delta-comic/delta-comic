<script setup lang="ts">
import { DBUtils, PluginArchiveDB } from '@delta-comic/db'
import { NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

const props = defineProps<{ actions: { title: string; icon: Component; onClick: () => any }[] }>()
const { t } = useI18n()

const isShowMenu = shallowRef(false)

const closeMenuBefore = (v: any) => {
  isShowMenu.value = false
  return v
}
const { data: totalCount } = PluginArchiveDB.useQuery(db =>
  DBUtils.countDb(db.where('enable', '=', true)),
)

const runPrimaryAction = () => {
  if (totalCount.value) return
  return props.actions.at(-1)?.onClick()
}
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
    :aria-label="
      totalCount ? t('plugin.startup.actions.chooseMode') : t('plugin.startup.actions.start')
    "
    @click="runPrimaryAction"
  >
    <NIcon :size="25">
      <Icons.material.CheckRound />
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
            <NFloatButton
              class="z-100000!"
              :aria-label="action.title"
              @click="closeMenuBefore(action.onClick())"
            >
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