<script setup lang="ts">
import { pluginRuntime, type PluginLoadingInfo } from '@delta-comic/plugin'
import {
  type MenuOption,
  NDrawer,
  NIcon,
  NMenu,
  NSpin,
  NTabPane,
  NTabs,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, type Component, h, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { pluginStartupMemory } from '@/features/pluginStartup/PluginStartupMemory'
import { Icons } from '@/icons'
import Config from '@/pages/main/plugin/config.vue'
import Download from '@/pages/main/plugin/download.vue'
import List from '@/pages/main/plugin/list.vue'
import Shop from '@/pages/main/plugin/shop.vue'

import pkg from '../../../package.json'

import ActionButtonGroup from './actionButtonGroup.vue'
import LoadList from './loadList.vue'

const props = defineProps<{ startupReady: boolean }>()
const show = defineModel<boolean>('show', { required: true })
const isBooted = defineModel<boolean>('isBooted', { required: true })
const { t } = useI18n()
const renderIcon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })

const pluginPages = computed(
  () =>
    [
      {
        label: t('plugin.menu.manage'),
        key: 'list',
        icon: renderIcon(Icons.material.AutoAwesomeMosaicOutlined),
        comp: List,
      },
      {
        label: t('plugin.menu.install'),
        key: 'download',
        icon: renderIcon(Icons.material.FileDownloadOutlined),
        comp: Download,
      },
      {
        label: t('plugin.menu.market'),
        key: 'shop',
        icon: renderIcon(Icons.material.ShoppingBagOutlined),
        comp: Shop,
      },
      {
        label: t('plugin.menu.config'),
        key: 'config',
        icon: renderIcon(Icons.antd.SettingOutlined),
        comp: Config,
      },
    ] as const,
)

const menuOptions = computed<MenuOption[]>(() => [
  ...pluginPages.value,
  { label: t('plugin.menu.version', { version: pkg.version }), key: 'version', disabled: true },
])
const pageSelect = shallowRef<'config' | 'download' | 'list' | 'shop'>('list')

const bootingSteps = ref<Record<string, PluginLoadingInfo>>()
const $dialog = useDialog()
const $message = useMessage()

const promptToRemember = (safe: boolean) => {
  $dialog.info({
    title: t('plugin.startup.remember.title'),
    content: t('plugin.startup.remember.content'),
    positiveText: t('plugin.startup.remember.positive'),
    negativeText: t('plugin.startup.remember.negative'),
    closable: false,
    maskClosable: false,
    onPositiveClick() {
      pluginStartupMemory.remember(pluginRuntime.activeNormalPluginNames, safe)
    },
    onNegativeClick() {
      pluginStartupMemory.clear()
    },
  })
}

const boot = async (safe = false, pluginNames?: readonly string[], remembered = false) => {
  if (!props.startupReady) return $message.warning(t('plugin.startup.prebootLoading'))
  if (bootingSteps.value || isBooted.value) return $message.warning(t('plugin.startup.loading'))
  window.$$safe$$ = safe
  const { operation, progress } = pluginRuntime.loadNormal({ pluginNames })
  const watcher = watch(progress, steps => (bootingSteps.value = steps), {
    immediate: true,
    deep: true,
  })
  try {
    await operation
    if (Object.values(progress.value).some(value => value.progress.status === 'error')) {
      show.value = true
      return $message.error(t('plugin.startup.errors.partialFailure'))
    }
    isBooted.value = true
    show.value = false
    if (!remembered) promptToRemember(safe)
  } catch (error) {
    show.value = true
    $message.error(error instanceof Error ? error.message : String(error))
  } finally {
    watcher.stop()
    bootingSteps.value = undefined
  }
}

let rememberedStartupAttempted = false
watch(
  () => props.startupReady,
  ready => {
    if (!ready || rememberedStartupAttempted) return
    rememberedStartupAttempted = true
    const preference = pluginStartupMemory.read()
    if (preference) void boot(preference.safe, preference.pluginNames, true)
  },
  { immediate: true },
)
</script>

<template>
  <NDrawer v-model:show="show" placement="bottom">
    <NSpin :show="!!bootingSteps" class="relative size-full" contentClass="size-full">
      <div class="flex size-full flex-col overflow-hidden">
        <NMenu
          v-model:value="pageSelect"
          mode="horizontal"
          :options="menuOptions"
          responsive
          class="shrink-0"
        />
        <!-- content pages -->
        <NTabs
          v-model:value="pageSelect"
          animated
          class="min-h-0 flex-1 [&_.n-tab-pane]:h-full! [&_.n-tab-pane]:p-0! [&_.n-tabs-nav]:hidden! [&_.n-tabs-pane-wrapper]:h-full!"
        >
          <NTabPane
            v-for="page in pluginPages"
            :key="page.key"
            :name="page.key"
            :tab="page.label"
            display-directive="show:lazy"
            class="size-full!"
          >
            <component :is="page.comp" />
          </NTabPane>
        </NTabs>
      </div>
      <!-- boot button group -->
      <ActionButtonGroup
        :actions="[
          {
            title: t('plugin.startup.actions.safeStart'),
            icon: Icons.antd.SafetyOutlined,
            onClick: () => boot(true),
          },
          {
            title: t('plugin.startup.actions.start'),
            icon: Icons.material.CheckRound,
            onClick: () => boot(false),
          },
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