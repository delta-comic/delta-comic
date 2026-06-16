<script setup lang="ts">
import { Loader } from '@delta-comic/plugin'
import { type MenuOption, NIcon, useMessage } from 'naive-ui'
import { type Component, h, ref, shallowRef, watch } from 'vue'

import { Icons } from '@/icons'
import Config from '@/pages/main/plugin/config.vue'
import Download from '@/pages/main/plugin/download.vue'
import List from '@/pages/main/plugin/list.vue'

import pkg from '../../../package.json'

import ActionButtonGroup from './actionButtonGroup.vue'
import LoadList from './loadList.vue'

const show = defineModel<boolean>('show', { required: true })
const isBooted = defineModel<boolean>('isBooted', { required: true })
const pageSelect = shallowRef<(typeof menuOptions)[number]['key']>('list')
const renderIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })

const menuOptions = [
  {
    label: '管理',
    key: 'list',
    icon: renderIcon(Icons.material.AutoAwesomeMosaicOutlined),
    comp: List,
  },
  {
    label: '安装',
    key: 'download',
    icon: renderIcon(Icons.material.FileDownloadOutlined),
    comp: Download,
  },
  { label: '配置', key: 'config', icon: renderIcon(Icons.antd.SettingOutlined), comp: Config },
  { label: `版本: ${pkg.version}`, key: 'version', disabled: true },
] satisfies MenuOption[]

const bootingSteps = ref<Record<string, Loader.PluginLoadingInfo>>()
const boot = async (safe = false) => {
  if (bootingSteps.value || isBooted.value) return $message.warning('正在启动中')
  window.$$safe$$ = safe
  const steps = Loader.loadAllPlugins()
  const watcher = watch(steps, steps => (bootingSteps.value = steps), {
    immediate: true,
    deep: true,
  })
  isBooted.value = true
  show.value = false
  try {
    await steps
  } finally {
    watcher.stop()
  }
}

const $message = useMessage()
</script>

<template>
  <NDrawer v-model:show="show" placement="bottom">
    <NSpin :show="!!bootingSteps" class="relative size-full" contentClass="size-full">
      <div class="size-full overflow-hidden">
        <NMenu v-model:value="pageSelect" mode="horizontal" :options="menuOptions" responsive />
        <!-- content pages -->
        <VanTabs v-model:active="pageSelect" swipeable :show-header="false">
          <VanTab
            v-for="menu in menuOptions.filter(v => !v.disabled)"
            :name="menu.key"
            class="size-full! *:size-full!"
          >
            <component :is="menu.comp" />
          </VanTab>
        </VanTabs>
      </div>
      <!-- boot button group -->
      <ActionButtonGroup
        :actions="[
          { title: '安全启动', icon: Icons.antd.SafetyOutlined, onClick: () => boot(true) },
          { title: '启动', icon: Icons.material.CheckRound, onClick: () => boot(false) },
        ]"
      />
      <template #description>
        <AnimatePresence>
          <LoadList :bootingSteps v-if="bootingSteps" />
        </AnimatePresence>
      </template>
    </NSpin>
  </NDrawer>
</template>