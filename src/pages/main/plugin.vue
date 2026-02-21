<script setup lang="ts">
import { SettingOutlined } from '@vicons/antd'
import {
  AutoAwesomeMosaicOutlined,
  ShoppingBagOutlined,
  FileDownloadOutlined
} from '@vicons/material'
import { type MenuOption, NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { h } from 'vue'
definePage({ redirect: { name: '/main/plugin/list' } })

const icon = (icon: Component) => () => h(NIcon, null, { default: () => h(icon) })
const menuOptions = [
  { label: '管理', key: 'list', icon: icon(AutoAwesomeMosaicOutlined) },
  { label: '安装', key: 'download', icon: icon(FileDownloadOutlined) },
  { label: '市场', key: 'shop', icon: icon(ShoppingBagOutlined) },
  { label: '配置', key: 'config', icon: icon(SettingOutlined) }
] as MenuOption[]
</script>

<template>
  <div class="w-full bg-(--van-background-2) pt-safe"></div>
  <NMenu
    :value="$route.path.split('/').at(-1)!"
    @update:value="v => $router.force.replace({ name: `/main/plugin/${v}` })"
    mode="horizontal"
    :options="menuOptions"
    responsive
  />
  <div class="h-[calc(100%-var(--safe-area-inset-top)-42px)] w-full">
    <RouterView />
  </div>
</template>