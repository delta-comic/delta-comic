<script setup lang="ts">
import { logger } from '@delta-comic/logger'
import {
  pluginRuntime,
  setPluginEnabled,
  translatePluginText,
  uninstallPlugin,
  updatePluginByName,
  type PluginCandidate,
  usePluginStore,
} from '@delta-comic/plugin'
import { memoize } from 'es-toolkit'
import type { DropdownOption } from 'naive-ui'
import semver from 'semver'
import { computed, shallowReactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PluginIcon from '@/components/plugin/PluginIcon.vue'
import { usePluginInstall } from '@/features/pluginInstall/usePluginInstall'
import { Icons } from '@/icons'

import pkg from '../../../../package.json'

const pluginListLogger = logger.scoped('app:plugin-list')

const updating = shallowReactive(new Set<string>())
const { t } = useI18n()
const { runPluginInstall } = usePluginInstall()
const router = useRouter()
const openMarketplace = () => router.force.replace({ name: '/main/plugin/shop' })
type ManagedPlugin = {
  enable: boolean
  management: PluginCandidate['management']
  meta: PluginCandidate['manifest']
  origin: PluginCandidate['origin']
  pluginName: string
}
const updatePlugin = async (plugin: ManagedPlugin) => {
  if (updating.has(plugin.pluginName)) throw new Error(t('plugin.list.feedback.alreadyUpdating'))
  updating.add(plugin.pluginName)
  pluginListLogger.info('plugin update started', { plugin: plugin.pluginName })
  try {
    await runPluginInstall(
      t('plugin.progress.updateTitle', {
        plugin: translatePluginText(plugin.meta.name.display ?? plugin.pluginName),
      }),
      options => updatePluginByName(plugin.pluginName, options),
    )
    pluginListLogger.info('plugin update completed', { plugin: plugin.pluginName })
  } catch (error) {
    pluginListLogger.error('plugin update failed', { plugin: plugin.pluginName }, error)
    throw error
  } finally {
    updating.delete(plugin.pluginName)
  }
}

const checkIsSupport = memoize((supportCore: string) => semver.satisfies(pkg.version, supportCore))

const getCardClass = (plugin: ManagedPlugin) => {
  if (!plugin.enable)
    return 'bg-(--nui-icon-color-disabled)/20! border-(--nui-icon-color-pressed)/20!'
  if (checkIsSupport(plugin.meta.version.supportCore))
    return 'border-(--nui-primary-color)/20! bg-(--nui-primary-color-hover)/10!'
  return 'border-(--nui-warning-color)/20! bg-(--nui-warning-color-hover)/10!'
}

const pluginStore = usePluginStore()
const plugins = computed<ManagedPlugin[]>(() =>
  [...pluginStore.candidates].map(([pluginName, candidate]) => ({
    enable: candidate.enabled,
    management: candidate.management,
    meta: candidate.manifest,
    origin: candidate.origin,
    pluginName,
  })),
)
const isBuiltIn = (plugin: ManagedPlugin) => plugin.origin === 'builtin'
const actionsFor = (plugin: ManagedPlugin): DropdownOption[] => {
  const actions: DropdownOption[] = plugin.management.canDisable
    ? [
        {
          key: 'toggle',
          label: plugin.enable ? t('plugin.list.actions.disable') : t('plugin.list.actions.enable'),
        },
      ]
    : []
  if (!plugin.management.canUninstall) return actions
  const installedActions: DropdownOption[] = [{ key: 'remove', label: t('common.actions.delete') }]
  if (plugin.management.canUpdate) {
    installedActions.splice(installedActions.length - 1, 0, {
      key: 'update',
      label: t('plugin.list.actions.updateFromSource'),
      disabled: updating.has(plugin.pluginName),
    })
  }
  return actions.concat(installedActions)
}

const handleAction = async (plugin: ManagedPlugin, key: string) => {
  pluginListLogger.debug('plugin action requested', { action: key, plugin: plugin.pluginName })
  switch (key) {
    case 'toggle':
      await setPluginEnabled(plugin.pluginName, !plugin.enable)
      break
    case 'update':
      await updatePlugin(plugin)
      break
    case 'remove':
      await uninstallPlugin(plugin.pluginName)
      pluginListLogger.info('plugin removed', { plugin: plugin.pluginName })
  }
}
</script>

<template>
  <NScrollbar class="size-full">
    <NEmpty
      v-if="plugins.length === 0"
      :description="t('plugin.list.empty.description')"
      class="pt-20"
    >
      <template #extra>
        <NButton type="primary" @click="openMarketplace">
          {{ t('plugin.list.empty.action') }}
        </NButton>
      </template>
    </NEmpty>
    <TransitionGroup tag="ul" name="list">
      <NCard
        v-for="plugin of plugins"
        :key="plugin.pluginName"
        header-class="pt-1! pb-0! px-3!"
        content-class="pb-1! px-3!"
        :class="[getCardClass(plugin)]"
        class="mx-auto mt-1 w-[calc(100%-6px)]! duration-100!"
      >
        <template #header>
          <div class="flex min-w-0 items-center gap-2.5">
            <PluginIcon
              :icon="plugin.meta.icon"
              :name="translatePluginText(plugin.meta.name.display ?? plugin.pluginName)"
              :plugin-id="plugin.pluginName"
              size="small"
            />
            <span class="dc-ellipsis">
              <span class="mr-0.5 font-thin italic">{{
                isBuiltIn(plugin) ? t('plugin.list.kind.builtInPrefix') : ''
              }}</span>
              {{ translatePluginText(plugin.meta.name.display ?? plugin.pluginName) }}
            </span>
          </div>
        </template>
        <template #header-extra>
          <span class="ml-2 font-light text-(--nui-text-color-3) italic">
            {{ plugin.enable ? t('plugin.list.status.enabled') : t('plugin.list.status.disabled') }}
          </span>
          <NDropdown
            v-if="actionsFor(plugin).length > 0"
            :options="actionsFor(plugin)"
            placement="bottom-end"
            @select="(key: string | number) => handleAction(plugin, String(key))"
          >
            <NButton circle quaternary class="ml-3!" :aria-label="t('plugin.list.actions.menu')">
              <template #icon>
                <NIcon><Icons.material.MenuRound /></NIcon>
              </template>
            </NButton>
          </NDropdown>
        </template>
        <span
          class="mr-3 font-bold text-(--nui-text-color-disabled) italic"
          v-if="plugin.meta.version"
        >
          {{ semver.valid(semver.coerce(plugin.meta.version.plugin ?? 'v0')) }}
        </span>
        <span class="text-(--nui-text-color-3)">
          {{ translatePluginText(plugin.meta.description) }}
        </span>
        <div class="w-full text-xs text-(--nui-text-color-disabled)">
          {{ t('plugin.list.supportCore', { version: plugin.meta.version.supportCore }) }}
        </div>
        <div
          v-if="pluginRuntime.restartRequired.has(plugin.pluginName)"
          class="mb-1 text-xs text-(--nui-warning-color)"
        >
          {{ t('plugin.list.restartRequired') }}
        </div>
        <div
          class="mt-1 flex w-full items-center gap-1 text-sm! font-bold"
          v-if="!checkIsSupport(plugin.meta.version.supportCore)"
        >
          <NIcon color="var(--nui-warning-color)" size="1.2rem">
            <Icons.material.WarningRound />
          </NIcon>
          {{ t('plugin.list.incompatible') }}
        </div>
      </NCard>
    </TransitionGroup>
  </NScrollbar>
</template>