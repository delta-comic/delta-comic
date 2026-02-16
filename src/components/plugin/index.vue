<script setup lang="ts">
import { AutoAwesomeMosaicFilled, CheckRound, FileDownloadRound } from '@vicons/material'
import { SafetyOutlined, SettingOutlined } from '@vicons/antd'
import ActionButtonGroup from './actionButtonGroup.vue'
import List from './list.vue'
import Download from './download.vue'
import LoadList from './loadList.vue'
import Config from './config.vue'

import { type MenuOption, NIcon, useMessage } from 'naive-ui'
import { type Component, h, shallowRef } from 'vue'
import { loadAllPlugins } from '@delta-comic/plugin'
import { DcPopup } from '@delta-comic/ui'

import pkg from '../../../package.json'

const show = defineModel<boolean>('show', { required: true })
const isBooted = defineModel<boolean>('isBooted', { required: true })
const pageSelect = shallowRef<(typeof menuOptions)[number]['key']>('list')
const renderIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })

const menuOptions = [
  { label: '管理', key: 'list', icon: renderIcon(AutoAwesomeMosaicFilled), comp: List },
  { label: '安装', key: 'download', icon: renderIcon(FileDownloadRound), comp: Download },
  { label: '配置', key: 'config', icon: renderIcon(SettingOutlined), comp: Config },
  { label: `版本: ${pkg.version}`, key: 'version', disabled: true }
] satisfies MenuOption[]
const isBooting = shallowRef(false)
const boot = async (safe = false) => {
  if (isBooting.value || isBooted.value) return $message.warning('正在启动中')
  isBooting.value = true
  window.$$safe$$ = safe
  await loadAllPlugins()
  isBooted.value = true
  show.value = false
}

const $message = useMessage()
</script>

<template>
  <DcPopup v-model:show="show" position="bottom" round class="h-[80vh]" :before-close="() => !isBooting">
    <NSpin :show="isBooting" class="relative size-full *:first:size-full">
      <div class="size-full overflow-hidden">
        <NMenu v-model:value="pageSelect" mode="horizontal" :options="menuOptions" responsive />
        <!-- content pages -->
        <VanTabs v-model:active="pageSelect" swipeable :show-header="false"
          class="h-[calc(100%-42px)]! w-full! **:[.van-swipe-item]:h-full! **:[.van-tabs__content]:size-full!">
          <VanTab v-for="menu in menuOptions.filter(v => !v.disabled)" :name="menu.key" class="size-full! *:size-full!">
            <component :is="menu.comp" />
          </VanTab>
        </VanTabs>
      </div>
      <!-- boot button group -->
      <ActionButtonGroup :actions="[
        { title: '安全启动', icon: SafetyOutlined, onClick: () => boot(true) },
        { title: '启动', icon: CheckRound, onClick: () => boot(false) }
      ]" />
      <template #description>
        <AnimatePresence>
          <LoadList :isBooting />
        </AnimatePresence>
      </template>
    </NSpin>
  </DcPopup>
</template>