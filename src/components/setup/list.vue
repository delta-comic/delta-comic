<script setup lang='ts'>
import { MenuRound, WarningRound } from '@vicons/material'
import { Comp, Utils, version } from 'delta-comic-core'
import { shallowReactive } from 'vue'
import semver from 'semver'
import { memoize } from 'es-toolkit'
import { PluginArchiveDB } from '@/plugin/db'
import { updatePlugin } from '@/plugin'
import { computedAsync } from '@vueuse/core'
import { db } from '@/db'


const updating = shallowReactive(new Set<string>())
const _updatePlugin = async (plugin: PluginArchiveDB.Meta) => {
  if (updating.has(plugin.pluginName)) throw new Error('已经在更新')
  updating.add(plugin.pluginName)
  try {
    await updatePlugin(plugin)
  } finally {
    updating.delete(plugin.pluginName)
  }
}

const checkIsSupport = memoize((supportCore: string) => semver.satisfies(version, supportCore))

const getCardClass = (plugin: PluginArchiveDB.Meta) => {
  if (!plugin.enable)
    return 'bg-(--nui-icon-color-disabled)/20! border-(--nui-icon-color-pressed)/20!'
  if (checkIsSupport(plugin.meta.version.supportCore))
    return 'border-(--nui-primary-color)/20! bg-(--nui-primary-color-hover)/10!'
  return 'border-(--nui-warning-color)/20! bg-(--nui-warning-color-hover)/10!'
}

const codeArchives = computedAsync(() => db.value
  .selectFrom('plugin')
  .selectAll()
  .execute()
  , [])

</script>

<template>
  <Comp.Content :source="Utils.data.PromiseContent.resolve(codeArchives)" class="size-full">
    <NScrollbar class="size-full">
      <TransitionGroup tag="ul" name="list">
        <NCard v-for="plugin of codeArchives" :key="plugin.pluginName"
          :title="plugin.meta.name.display ?? plugin.pluginName" header-class="pt-1! pb-0! px-3!"
          content-class="pb-1! px-3!" :class="[getCardClass(plugin)]"
          class="w-[calc(100%-6px)]! mx-auto mt-1 duration-100!">
          <template #header-extra>
            <!-- n-base-select-menu__empty -->
            <span class="text-(--text-color-3) italic font-light">{{ plugin.enable ? '已启用' : '未启用' }}</span>
            <VanPopover :actions="[{
              text: plugin.enable ? '禁用' : '启用',
              onClick: () => void PluginArchiveDB.toggleEnable(plugin.pluginName)
            }, {
              text: '删除',
              onClick: () => void db.deleteFrom('plugin')
                .where('pluginName', '=', plugin.pluginName)
                .execute()
            }, {
              text: '从下载源更新',
              disabled: updating.has(plugin.pluginName),
              onClick: () => _updatePlugin(plugin)
            }]" placement="left-start" @select="v => v.onClick()">
              <template #reference>
                <NButton circle quaternary class="ml-3!">
                  <template #icon>
                    <NIcon>
                      <MenuRound />
                    </NIcon>
                  </template>
                </NButton>
              </template>
            </VanPopover>
          </template>
          <span class="text-(--nui-text-color-disabled) italic font-bold mr-3" v-if="plugin.meta.version">
            {{ semver.valid(semver.coerce(plugin.meta.version.plugin ?? 'v0')) }}
          </span>
          <span class="text-(--nui-text-color-3)">{{ plugin.meta.description }}</span>
          <div class="w-full text-(--nui-text-color-disabled) text-xs">适应核心版本: {{ plugin.meta.version.supportCore }}
          </div>
          <div class="w-full flex gap-1 font-bold items-center mt-1 text-sm!"
            v-if="!checkIsSupport(plugin.meta.version.supportCore)">
            <NIcon color="var(--nui-warning-color)" size="1.2rem">
              <WarningRound />
            </NIcon>
            插件不支持当前核心版本
          </div>
        </NCard>
      </TransitionGroup>
    </NScrollbar>
  </Comp.Content>
</template>