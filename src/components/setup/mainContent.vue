<script setup lang='ts'>
import { AutoAwesomeMosaicFilled, CheckRound, FileDownloadRound } from '@vicons/material'
import { Comp, Utils, version } from 'delta-comic-core'
import { type MenuOption, NIcon, useMessage } from 'naive-ui'
import type { Component } from 'vue'
import { computed, h, shallowRef } from 'vue'
import List from './list.vue'
import Download from './download.vue'
import { usePluginStore } from '@/plugin/store'
import { loadAllPlugins } from '@/plugin'
import { SafetyOutlined, SettingOutlined } from '@vicons/antd'
import { motion } from 'motion-v'
import { computedAsync } from '@vueuse/core'
import { db, DBUtils } from '@/db'
import Config from './config.vue'

const pluginStore = usePluginStore()
const show = defineModel<boolean>('show', { required: true })
const isBooted = defineModel<boolean>('isBooted', { required: true })
const pageSelect = shallowRef<(typeof menuOptions)[number]['key']>('list')
const renderIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })

const menuOptions = [
  {
    label: '管理',
    key: 'list',
    icon: renderIcon(AutoAwesomeMosaicFilled),
    comp: List
  },
  {
    label: '安装',
    key: 'download',
    icon: renderIcon(FileDownloadRound),
    comp: Download
  },
  {
    label: '配置',
    key: 'config',
    icon: renderIcon(SettingOutlined),
    comp: Config
  },
  {
    label: `核心版本: ${version}`,
    key: 'version',
    disabled: true
  }
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

const isShowMenu = shallowRef(false)

const closeMenuBefore = (v: any) => {
  isShowMenu.value = false
  return v
}
const allErrors = computed(() => Object.entries(pluginStore.pluginSteps).filter(v => v[1].now.error).map(v => [v[0], v[1].now.error!] as [plugin: string, error: Error]))

const rebootApp = () => {
  Utils.message.createLoadingMessage('重启中')
  location.reload()
}

const totalCount = computedAsync(() => DBUtils.countDb(db.value
  .selectFrom('plugin')
  .where('enable', '=', true)
), 0)
</script>

<template>
  <Comp.Popup v-model:show="show" position="bottom" round class="h-[80vh]" :before-close="() => !isBooting">
    <NSpin :show="isBooting" class="size-full *:first:size-full relative">
      <div class="size-full flex flex-col">
        <NMenu v-model:value="pageSelect" mode="horizontal" :options="menuOptions" responsive />
        <VanTabs v-model:active="pageSelect" swipeable :show-header="false"
          class="size-full! *:size-full! *:*:size-full! *:*:*:size-full!">
          <VanTab v-for="menu in menuOptions.filter(v => !v.disabled)" :name="menu.key" class="size-full! *:size-full!">
            <component :is="menu.comp" />
          </VanTab>
        </VanTabs>
      </div>
      <NFloatButton :right="10" :bottom="10" class="z-100000!" type="primary" shape="circle" menu-trigger="click"
        v-model:show-menu="isShowMenu">
        <NIcon :size="25">
          <CheckRound />
        </NIcon>
        <template #menu>
          <template v-if="totalCount">
            <NPopover trigger="manual" :show="isShowMenu" placement="left-end">
              <template #trigger>
                <NFloatButton class="z-100000!" @click="closeMenuBefore(boot(true))">
                  <NIcon :size="20">
                    <SafetyOutlined />
                  </NIcon>
                </NFloatButton>
              </template>
              安全启动
            </NPopover>
            <NPopover trigger="manual" :show="isShowMenu" placement="left-end">
              <template #trigger>
                <NFloatButton class="z-100000!" @click="closeMenuBefore(boot(false))" type="primary">
                  <NIcon :size="20">
                    <CheckRound />
                  </NIcon>
                </NFloatButton>
              </template>
              启动
            </NPopover>
          </template>
        </template>
      </NFloatButton>
      <template #description>
        <motion.div :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
          :exit="{ opacity: 0, scale: '50%', translateY: '85px' }"
          :animate="{ opacity: 1, scale: '100%', translateY: '0px' }">
          <VanCellGroup class="w-[80vw] h-80 shadow-2xl" inset>
            <TransitionGroup name="list" tag="ul" class="size-full!">
              <VanCell title="core" label="载入应用内容..." center key="core">
                <template #right-icon>
                  <VanLoading size="25px" />
                </template>
              </VanCell>
              <template v-for="[plugin, { steps, now }] in Object.entries(pluginStore.pluginSteps)">
                <VanCell :title="pluginStore.$getPluginDisplayName(plugin)" v-if="steps[now.stepsIndex]" :key="plugin"
                  :label="`${steps[now.stepsIndex].name}: ${steps[now.stepsIndex].description}`"
                  :class="[now.status == 'error' && 'bg-(--nui-error-color)/20!']" />
              </template>
            </TransitionGroup>
          </VanCellGroup>
        </motion.div>

        <motion.div :initial="{ opacity: 0, scale: '50%', translateY: '85px' }"
          :exit="{ opacity: 0, scale: '50%', translateY: '85px' }" class="relative"
          :animate="{ opacity: 1, scale: '100%', translateY: '0px' }" v-if="allErrors.length">
          <NButton type="primary" class="absolute! right-10!" @click="rebootApp">重新加载</NButton>
        </motion.div>
      </template>
    </NSpin>
  </Comp.Popup>
</template>