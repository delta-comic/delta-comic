<script setup lang="ts">
import { PluginArchiveDB } from '@delta-comic/db'
import { Install, translatePluginText, usePluginStore } from '@delta-comic/plugin'
import { memoize } from 'es-toolkit'
import type { DropdownOption } from 'naive-ui'
import semver from 'semver'
import { shallowReactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

import pkg from '../../../../package.json'

const updating = shallowReactive(new Set<string>())
const { t } = useI18n()
const updatePlugin = async (plugin: PluginArchiveDB.Archive) => {
  if (updating.has(plugin.pluginName)) throw new Error(t('plugin.list.feedback.alreadyUpdating'))
  updating.add(plugin.pluginName)
  try {
    await Install.updatePlugin(plugin)
  } finally {
    updating.delete(plugin.pluginName)
  }
}

const checkIsSupport = memoize((supportCore: string) => semver.satisfies(pkg.version, supportCore))

const getCardClass = (plugin: PluginArchiveDB.Archive) => {
  if (!plugin.enable)
    return 'bg-(--nui-icon-color-disabled)/20! border-(--nui-icon-color-pressed)/20!'
  if (checkIsSupport(plugin.meta.version.supportCore))
    return 'border-(--nui-primary-color)/20! bg-(--nui-primary-color-hover)/10!'
  return 'border-(--nui-warning-color)/20! bg-(--nui-warning-color-hover)/10!'
}

const { toggle } = PluginArchiveDB.useToggleEnable()
const { setKind } = PluginArchiveDB.useSetKind()

const codeArchives = PluginArchiveDB.useQuery(
  db => db.selectAll().execute(),
  [],
  () => [],
)
const pluginStore = usePluginStore()
watch(pluginStore.revision, () => codeArchives.refetch())
const isBuiltIn = (plugin: PluginArchiveDB.Archive) => plugin.loaderName === 'builtin'
const actionsFor = (plugin: PluginArchiveDB.Archive): DropdownOption[] => {
  const actions: DropdownOption[] = [
    {
      key: 'toggle',
      label: plugin.enable ? t('plugin.list.actions.disable') : t('plugin.list.actions.enable'),
    },
  ]
  if (isBuiltIn(plugin)) return actions
  return actions.concat(
    {
      key: 'kind-normal',
      label: t('plugin.list.actions.setNormal'),
      disabled: (plugin.meta.kind ?? 'normal') === 'normal',
    },
    {
      key: 'kind-preboot',
      label: t('plugin.list.actions.setPreboot'),
      disabled: plugin.meta.kind === 'preboot',
    },
    {
      key: 'update',
      label: t('plugin.list.actions.updateFromSource'),
      disabled: updating.has(plugin.pluginName),
    },
    { key: 'remove', label: t('common.actions.delete') },
  )
}

const handleAction = async (plugin: PluginArchiveDB.Archive, key: string) => {
  switch (key) {
    case 'toggle':
      await toggle({ keys: [plugin.pluginName] })
      break
    case 'kind-normal':
      await setKind({ kind: 'normal', pluginName: plugin.pluginName })
      break
    case 'kind-preboot':
      await setKind({ kind: 'preboot', pluginName: plugin.pluginName })
      break
    case 'update':
      await updatePlugin(plugin)
      break
    case 'remove':
      await Install.uninstallPlugin(plugin.pluginName)
      await codeArchives.refetch()
  }
}
</script>

<template>
  <DcContent
    :source="{ type: 'query', query: codeArchives }"
    class="size-full"
    v-slot="{ data: query }"
  >
    <NScrollbar class="size-full">
      <TransitionGroup tag="ul" name="list">
        <NCard
          v-for="plugin of query"
          :key="plugin.pluginName"
          :title="translatePluginText(plugin.meta.name.display ?? plugin.pluginName)"
          header-class="pt-1! pb-0! px-3!"
          content-class="pb-1! px-3!"
          :class="[getCardClass(plugin)]"
          class="mx-auto mt-1 w-[calc(100%-6px)]! duration-100!"
        >
          <template #header-extra>
            <!-- n-base-select-menu__empty -->
            <NTag
              class="ml-2"
              size="small"
              :type="plugin.meta.kind === 'preboot' ? 'warning' : 'default'"
            >
              {{ isBuiltIn(plugin) ? t('plugin.list.kind.builtInPrefix') : ''
              }}{{
                plugin.meta.kind === 'preboot'
                  ? t('plugin.list.kind.preboot')
                  : t('plugin.list.kind.normal')
              }}
            </NTag>
            <span class="ml-2 font-light text-(--nui-text-color-3) italic">
              {{
                plugin.enable ? t('plugin.list.status.enabled') : t('plugin.list.status.disabled')
              }}
            </span>
            <NDropdown
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
            v-if="plugin.meta.kind === 'preboot'"
            class="mt-1 text-xs text-(--nui-warning-color)"
          >
            {{ t('plugin.list.prebootRestartNotice') }}
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
  </DcContent>
</template>