<script setup lang="ts">
import { Install, translatePluginText } from '@delta-comic/plugin'
import { toReactive, useFileDialog } from '@vueuse/core'
import { useDialog, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { installFilePlugin, installPlugin, installers } = Install
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
    await installPlugin(url)
  } catch (error) {
    console.error(error)
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

      await installFilePlugin(file)
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
    <TransitionGroup name="list" tag="ul" class="ml-10 h-1/2 w-full overflow-auto *:my-1">
      <li
        name="list"
        tag="ul"
        class="mx-auto my-4! flex w-5/6 items-center gap-3 rounded-lg px-2"
        :class="[index == 0 && inputUrl && 'bg-green-300/60']"
        :key="desc.name"
        v-for="(desc, index) of inputUrl.length == 0
          ? installers
          : installers.filter(v => v.isMatched(inputUrl))"
      >
        <span
          class="item-center size-2 shrink-0 rounded-full bg-(--dc-text)"
          aria-hidden="true"
        ></span>
        <div>
          <div class="dc-hairline--bottom text-base font-semibold">
            {{ translatePluginText(desc.description.title) }}
          </div>
          <div>{{ translatePluginText(desc.description.description) }}</div>
        </div>
      </li>
    </TransitionGroup>
  </NScrollbar>
</template>