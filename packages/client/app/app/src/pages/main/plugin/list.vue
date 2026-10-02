<script setup lang="ts">
import { logger } from '@delta-comic/logger'
import {
  setPluginConfig,
  pluginFiberStates,
  setPluginEnabled,
  uninstallPlugin,
  updatePluginByName,
  type PluginInstallation,
  usePluginStore,
} from '@delta-comic/plugin'
import type { DropdownOption } from 'naive-ui'
import semver from 'semver'
import { computed, shallowReactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PluginIcon from '@/components/plugin/PluginIcon.vue'
import { usePluginInstall } from '@/features/pluginInstall/usePluginInstall'
import { translateText } from '@/i18n'
import { Icons } from '@/icons'
import { isTauriRuntime, openPluginDirectory } from '@/platform'

const pluginListLogger = logger.scoped('app:plugin-list')

const updating = shallowReactive(new Set<string>())
const { t } = useI18n()
const { runPluginInstall } = usePluginInstall()
const router = useRouter()
const openMarketplace = () => router.force.replace({ name: '/main/plugin/shop' })
type ManagedPlugin = {
  enable: boolean
  config: PluginInstallation['config']
  meta: PluginInstallation['manifest']
  origin: PluginInstallation['origin']
  pluginName: string
}
const updatePlugin = async (plugin: ManagedPlugin) => {
  if (updating.has(plugin.pluginName)) throw new Error(t('plugin.list.feedback.alreadyUpdating'))
  updating.add(plugin.pluginName)
  pluginListLogger.info('plugin update started', { plugin: plugin.pluginName })
  try {
    await runPluginInstall(
      t('plugin.progress.updateTitle', { plugin: translateText(plugin.meta.name) }),
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

const getCardClass = (plugin: ManagedPlugin) => {
  if (!plugin.enable)
    return 'bg-(--nui-icon-color-disabled)/20! border-(--nui-icon-color-pressed)/20!'
  return 'border-(--nui-primary-color)/20! bg-(--nui-primary-color-hover)/10!'
}

const pluginStore = usePluginStore()
const plugins = computed<ManagedPlugin[]>(() =>
  [...pluginStore.installations].map(([pluginName, candidate]) => ({
    enable: candidate.enabled,
    config: candidate.config,
    meta: candidate.manifest,
    origin: candidate.origin,
    pluginName,
  })),
)
const isBuiltIn = (plugin: ManagedPlugin) => plugin.origin === 'builtin'
const canOpenLocally = (plugin: ManagedPlugin) => isTauriRuntime() && !isBuiltIn(plugin)
const editing = shallowRef<ManagedPlugin>()
const configText = shallowRef('')
const saveConfig = async () => {
  if (!editing.value) return
  try {
    const value: unknown = JSON.parse(configText.value)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(t('plugin.list.configObject'))
    }
    await setPluginConfig(editing.value.pluginName, Object.fromEntries(Object.entries(value)))
    editing.value = undefined
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  }
}
const fiberState = (id: string) =>
  Object.entries(pluginFiberStates).find(
    ([, state]) => state === (pluginStore.statuses.get(id)?.state ?? pluginFiberStates.DISPOSED),
  )?.[0]
const actionsFor = (plugin: ManagedPlugin): DropdownOption[] => {
  const actions: DropdownOption[] = !isBuiltIn(plugin)
    ? [
        {
          key: 'toggle',
          label: plugin.enable ? t('plugin.list.actions.disable') : t('plugin.list.actions.enable'),
        },
      ]
    : []
  if (isBuiltIn(plugin)) return actions
  if (!pluginStore.fibers.has(plugin.pluginName) && plugin.enable) {
    actions.unshift({ key: 'activate', label: t('plugin.list.actions.enable') })
  }
  const installedActions: DropdownOption[] = [
    { key: 'config', label: t('plugin.menu.config') },
    { key: 'remove', label: t('common.actions.delete') },
  ]
  {
    installedActions.splice(installedActions.length - 1, 0, {
      key: 'update',
      label: t('plugin.list.actions.updateFromSource'),
      disabled: updating.has(plugin.pluginName),
    })
  }
  if (canOpenLocally(plugin)) {
    installedActions.unshift({ key: 'open-local', label: t('plugin.list.actions.openLocal') })
  }
  return actions.concat(installedActions)
}

const handleAction = async (plugin: ManagedPlugin, key: string) => {
  pluginListLogger.debug('plugin action requested', { action: key, plugin: plugin.pluginName })
  try {
    switch (key) {
      case 'activate':
        await setPluginEnabled(plugin.pluginName, true)
        break
      case 'config':
        configText.value = JSON.stringify(plugin.config, null, 2)
        editing.value = plugin
        break
      case 'toggle': {
        const enabled = !plugin.enable
        const name = translateText(plugin.meta.name)
        try {
          await setPluginEnabled(plugin.pluginName, enabled)
          window.$message.success(
            enabled
              ? t('plugin.list.feedback.enabled', { plugin: name })
              : t('plugin.list.feedback.disabled', { plugin: name }),
          )
        } catch (error) {
          pluginListLogger.error(
            'plugin toggle failed',
            { plugin: plugin.pluginName, enabled },
            error,
          )
          window.$message.error(error instanceof Error ? error.message : String(error))
        }
        break
      }
      case 'update':
        await updatePlugin(plugin)
        break
      case 'remove':
        await uninstallPlugin(plugin.pluginName)
        pluginListLogger.info('plugin removed', { plugin: plugin.pluginName })
        break
      case 'open-local':
        await openPluginDirectory(plugin.pluginName)
        break
    }
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <NScrollbar class="size-full">
    <NAlert v-if="pluginStore.safeMode.value" type="warning" class="mb-2">
      {{ t('plugin.list.safeMode') }}
    </NAlert>
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
              :name="translateText(plugin.meta.name)"
              :plugin-id="plugin.pluginName"
              :icon="plugin.meta.icon"
              size="small"
            />
            <span class="dc-ellipsis">
              <span class="mr-0.5 font-thin italic">{{
                isBuiltIn(plugin) ? t('plugin.list.kind.builtInPrefix') : ''
              }}</span>
              {{ translateText(plugin.meta.name) }}
            </span>
          </div>
        </template>
        <template #header-extra>
          <span class="ml-2 font-light text-(--nui-text-color-3) italic">
            {{ plugin.enable ? t('plugin.list.status.enabled') : t('plugin.list.status.disabled') }}
            · {{ fiberState(plugin.pluginName) }}
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
          {{ semver.valid(semver.coerce(plugin.meta.version)) }}
        </span>
        <span class="text-(--nui-text-color-3)">
          {{ translateText(plugin.meta.description ?? '') }}
        </span>
        <div
          v-if="pluginStore.statuses.get(plugin.pluginName)?.error"
          class="mb-1 text-xs text-(--nui-warning-color)"
        >
          {{ pluginStore.statuses.get(plugin.pluginName)?.source }}:
          {{ pluginStore.statuses.get(plugin.pluginName)?.error }}
        </div>
      </NCard>
    </TransitionGroup>
  </NScrollbar>
  <NModal
    :show="!!editing"
    preset="dialog"
    :title="t('plugin.menu.config')"
    :positive-text="t('common.actions.confirm')"
    @positive-click="saveConfig"
    @update:show="
      value => {
        if (!value) editing = undefined
      }
    "
  >
    <NInput v-model:value="configText" type="textarea" :autosize="{ minRows: 8, maxRows: 20 }" />
  </NModal>
</template>