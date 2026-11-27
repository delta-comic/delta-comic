<script setup lang="ts">
import { logger } from '@delta-comic/platform/logger'
import { useDialog, NScrollbar, NAutoComplete, NButton } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePluginInstall } from '@/features/pluginInstall/usePluginInstall'
import { installPlugin, pluginInstaller } from '@/plugin'

const pluginInstallLogger = logger.scoped('app:plugin-install')
const { t } = useI18n()
const { runPluginInstall } = usePluginInstall()
const dialogApi = useDialog()

const inputUrl = ref('')
const isAdding = ref(false)
const isValidInput = computed(() => pluginInstaller.isValidInput(inputUrl.value))
const protocolOptions = computed(() => {
  const input = inputUrl.value.toLowerCase()
  return pluginInstaller.inputPrefixes.filter(
    prefix => prefix.length > input.length && prefix.startsWith(input),
  )
})

const confirmAdd = () => {
  if (isAdding.value || !isValidInput.value) return
  const url = inputUrl.value
  isAdding.value = true

  const dialog = dialogApi.info({
    title: t('plugin.install.confirm.title'),
    content: t('plugin.install.confirm.content', { source: url }),
    positiveText: t('common.actions.confirm'),
    negativeText: t('common.actions.cancel'),
    onPositiveClick: async () => {
      if (dialog.loading) return false
      dialog.loading = true
      dialog.negativeButtonProps = { disabled: true }
      dialog.closable = false
      dialog.maskClosable = false
      dialog.closeOnEsc = false
      try {
        pluginInstallLogger.info('plugin installation confirmed')
        await runPluginInstall(t('plugin.progress.downloadTitle', { input: url }), options =>
          installPlugin(url, options),
        )
        pluginInstallLogger.info('plugin installation completed')
      } catch (error) {
        pluginInstallLogger.error('plugin installation failed', error)
      }
    },
    onAfterLeave: () => {
      isAdding.value = false
    },
  })
}
</script>

<template>
  <NScrollbar class="size-full">
    <div class="mb-2 pt-3 pl-5 text-2xl">{{ t('plugin.install.title') }}</div>
    <NAutoComplete
      :value="inputUrl"
      class="m-1.25 w-[calc(100%-10px)]!"
      clearable
      :options="protocolOptions"
      :get-show="() => !isAdding"
      :placeholder="t('plugin.install.placeholder')"
      :disabled="isAdding"
      :loading="isAdding"
      :status="inputUrl && !isValidInput ? 'error' : undefined"
      @update:value="inputUrl = $event ?? ''"
    />
    <div class="flex justify-center p-10">
      <NButton
        type="primary"
        size="large"
        class="w-1/2!"
        :loading="isAdding"
        :disabled="isAdding || !isValidInput"
        @click="confirmAdd"
        >{{ t('common.actions.confirm') }}
      </NButton>
    </div>
  </NScrollbar>
</template>