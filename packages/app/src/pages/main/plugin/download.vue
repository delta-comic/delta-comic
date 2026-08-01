<script setup lang="ts">
import { logger } from '@delta-comic/logger'
import { installPlugin } from '@delta-comic/plugin'
import { toReactive, useFileDialog } from '@vueuse/core'
import { useDialog, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const pluginInstallLogger = logger.scoped('app:plugin-install')
const { t } = useI18n()

const inputUrl = ref('')
const isAdding = ref(false)

const $message = useMessage()
const $dialog = useDialog()

const confirmAdd = async (url: string) => {
  if (isAdding.value) {
    $message.warning(t('plugin.install.feedback.installing'))
    return
  }
  isAdding.value = true

  try {
    await $dialog.create({
      type: 'info',
      title: t('plugin.install.confirm.title'),
      content: t('plugin.install.confirm.content', { source: url }),
      onPositiveClick: () => {
        return
      },
      onNegativeClick: () => {
        isAdding.value = false
      },
    })
    pluginInstallLogger.info('plugin installation confirmed')
    await installPlugin(url)
    pluginInstallLogger.info('plugin installation completed')
  } catch (error) {
    pluginInstallLogger.error('plugin installation failed', error)
  }
  isAdding.value = false
}

const upload = toReactive(useFileDialog({ accept: '', multiple: false }))
const useUploadPlugin = () => {
  if (isAdding.value) {
    $message.warning(t('plugin.install.feedback.installing'))
    return
  }
  isAdding.value = true
  upload.reset()
  upload.open()
  const { off: stop } = upload.onChange(async files => {
    stop()
    cel.off()
    try {
      const file = files?.item(0)
      if (!file) throw new Error(t('plugin.install.errors.noFile'))

      pluginInstallLogger.info('local plugin installation started')
      await installPlugin(file)
      pluginInstallLogger.info('local plugin installation completed')
    } catch (error) {
      pluginInstallLogger.error('local plugin installation failed', error)
    } finally {
      upload.reset()
      isAdding.value = false
    }
  })
  const cel = upload.onCancel(() => {
    upload.reset()
    stop()
    cel.off()
    isAdding.value = false
  })
}
</script>

<template>
  <NScrollbar class="size-full">
    <div class="mb-2 pt-3 pl-5 text-2xl">{{ t('plugin.install.title') }}</div>
    <NInput
      v-model:value="inputUrl"
      class="m-1.25 w-[calc(100%-10px)]!"
      clearable
      :placeholder="t('plugin.install.placeholder')"
      :disabled="isAdding"
      :loading="isAdding"
    />
    <div class="flex w-full items-center justify-center gap-4 p-10">
      <NButton
        type="primary"
        size="large"
        class="w-1/2!"
        :loading="isAdding"
        :disabled="isAdding"
        @click="confirmAdd(inputUrl)"
        >{{ t('common.actions.confirm') }}
      </NButton>
      <NButton
        type="primary"
        secondary
        size="large"
        class=""
        :loading="isAdding"
        :disabled="isAdding"
        @click="useUploadPlugin"
        >{{ t('plugin.install.useLocalFile') }}
      </NButton>
    </div>
  </NScrollbar>
</template>