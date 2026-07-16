<script setup lang="ts">
import { pluginRuntime } from '@delta-comic/plugin'
import { type MenuOption, NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { computed, h, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { Icons } from '@/icons'
definePage({ redirect: { name: '/main/plugin/list' } })
const router = useRouter()
const { t } = useI18n()

const icon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })
const menuOptions = computed<MenuOption[]>(() => [
  {
    label: t('plugin.menu.manage'),
    key: 'list',
    icon: icon(Icons.material.AutoAwesomeMosaicOutlined),
  },
  {
    label: t('plugin.menu.install'),
    key: 'download',
    icon: icon(Icons.material.FileDownloadOutlined),
  },
  { label: t('plugin.menu.market'), key: 'shop', icon: icon(Icons.material.ShoppingBagOutlined) },
  { label: t('plugin.menu.config'), key: 'config', icon: icon(Icons.antd.SettingOutlined) },
])

const reloading = shallowRef(false)
const reloadPlugins = async () => {
  if (reloading.value) return
  reloading.value = true
  try {
    const { operation } = pluginRuntime.reloadNormal()
    await operation
    window.$message.success(t('plugin.reload.success'))
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  } finally {
    reloading.value = false
  }
}
</script>

<template>
  <div class="w-full bg-(--dc-surface) pt-safe"></div>
  <div
    class="dc-hairline-bottom flex min-h-13 items-center bg-dc-surface [&_.n-menu-item-content-header]:max-[640px]:text-[0]!"
  >
    <NMenu
      class="min-w-0 flex-1"
      :value="$route.path.split('/').at(-1)!"
      @update:value="v => router.force.replace({ name: `/main/plugin/${v}` })"
      mode="horizontal"
      :options="menuOptions"
      responsive
    />
    <NButton
      class="mr-2 max-[640px]:px-2.5!"
      secondary
      type="primary"
      :loading="reloading"
      @click="reloadPlugins"
    >
      {{ t('plugin.reload.action') }}
    </NButton>
  </div>
  <div class="h-[calc(100%-var(--safe-area-inset-top)-52px)] w-full">
    <RouterView />
  </div>
</template>