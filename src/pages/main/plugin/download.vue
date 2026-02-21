<script setup lang="ts">
import { installFilePlugin, installPlugin, pluginInstallers } from '@delta-comic/plugin'
import { createDialog } from '@delta-comic/ui'
import { toReactive, useFileDialog } from '@vueuse/core'
import { useMessage } from 'naive-ui'
import { ref } from 'vue'
const inputUrl = ref('')
const isAdding = ref(false)
const $message = useMessage()
const confirmAdd = async (url: string) => {
  if (isAdding.value) {
    $message.warning('正在添加插件')
    return
  }
  isAdding.value = true

  try {
    await createDialog({
      type: 'info',
      title: '确认添加插件？',
      content: `添加来自"${url}"的插件`,
      onPositiveClick: () => {
        return
      },
      onNegativeClick: () => {
        isAdding.value = false
      }
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
    $message.warning('正在添加插件')
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
      if (!file) throw new Error('未上传文件')

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
    <div class="mb-2 pt-3 pl-5 text-2xl">插件安装</div>
    <NInput
      v-model:value="inputUrl"
      class="m-1.25 w-[calc(100%-10px)]!"
      clearable
      placeholder="输入内容以安装插件"
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
        >确认
      </NButton>
      <NButton
        type="primary"
        secondary
        size="large"
        class=""
        :loading="isAdding"
        :disabled="isAdding"
        @click="useUploadPlugin"
        >使用本地文件
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
          ? pluginInstallers
          : pluginInstallers.filter(v => v.isMatched(inputUrl))"
      >
        <span
          class="item-center size-2 shrink-0 rounded-full bg-(--van-text-color)"
          aria-hidden="true"
        ></span>
        <div>
          <div class="van-hairline--bottom text-base font-semibold">
            {{ desc.description.title }}
          </div>
          <div>{{ desc.description.description }}</div>
        </div>
      </li>
    </TransitionGroup>
  </NScrollbar>
</template>