<script setup lang="ts">
import { useConfig } from '@delta-comic/plugin'
import { DcCell, DcCellGroup } from '@delta-comic/ui'
import { useDialog, useMessage } from 'naive-ui'
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import LogReaderPanel from '@/components/logs/LogReaderPanel.vue'
import PluginConfigField from '@/components/plugin/PluginConfigField.vue'
import { pluginStartupMemory } from '@/features/pluginStartup/PluginStartupMemory'
import { translateText } from '@/i18n'
import { localizeFormConfig } from '@/i18n/pluginText'
import { isTauriRuntime } from '@/platform'

const $router = useRouter()
const config = useConfig()
const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const showNativeLogs = isTauriRuntime()
const showLogReader = shallowRef(false)

const confirmClearPluginStartup = () => {
  dialog.warning({
    title: t('settings.pluginStartup.confirmTitle'),
    content: t('settings.pluginStartup.confirmContent'),
    positiveText: t('common.actions.confirm'),
    negativeText: t('common.actions.cancel'),
    onPositiveClick: () => {
      pluginStartupMemory.clear()
      message.success(t('settings.pluginStartup.cleared'))
    },
  })
}
</script>

<template>
  <div
    class="box-content flex h-(--dc-page-header-height) items-center bg-(--dc-surface) px-4 pt-safe"
  >
    <NPageHeader class="w-full" :title="t('settings.title')" @back="$router.back()" />
  </div>
  <NScrollbar class="h-[calc(100%-var(--dc-page-header-height)-var(--safe-area-inset-top))] w-full">
    <div class="mx-auto w-full max-w-5xl py-2">
      <DcCellGroup
        v-for="[
          formKey,
          {
            form,
            data: { value: store },
            name: title,
          },
        ] of config.form.entries()"
        :key="formKey"
        :title="translateText(title)"
      >
        <template v-for="[name, config] of Object.entries(form)" :key="name">
          <PluginConfigField
            :config="localizeFormConfig(config)"
            :model-value="store[name]"
            @update:model-value="store[name] = $event"
          />
        </template>
      </DcCellGroup>
      <DcCellGroup :title="t('settings.pluginStartup.sectionTitle')">
        <DcCell
          center
          :title="t('settings.pluginStartup.clear')"
          :label="t('settings.pluginStartup.description')"
        >
          <NButton secondary type="warning" @click="confirmClearPluginStartup">
            {{ t('settings.pluginStartup.clear') }}
          </NButton>
        </DcCell>
      </DcCellGroup>
      <DcCellGroup v-if="showNativeLogs" :title="t('settings.logs.sectionTitle')">
        <DcCell center clickable :title="t('settings.logs.open')" @click="showLogReader = true">
          {{ t('settings.logs.openDescription') }}
        </DcCell>
      </DcCellGroup>
    </div>
  </NScrollbar>
  <NModal v-if="showNativeLogs" v-model:show="showLogReader" class="w-[min(96vw,72rem)]">
    <LogReaderPanel @close="showLogReader = false" />
  </NModal>
</template>