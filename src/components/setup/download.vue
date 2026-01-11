<script setup lang='ts'>
import { installPlugin, pluginInstallers } from '@/plugin'
import { toReactive, useFileDialog } from '@vueuse/core'
import { Utils } from 'delta-comic-core'
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
    await Utils.message.createDialog({
      type: 'info',
      title: '确认添加插件？',
      content: `添加来自"${url}"的插件`,
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
const upload = toReactive(useFileDialog({
  accept: '',
  multiple: false
}))
const useUploadPlugin = () => {
  if (isAdding.value) {
    $message.warning('正在添加插件')
    return
  }
  isAdding.value = true
  upload.reset()
  upload.open()
  const { off: stop } = upload.onChange(async (files) => {
    stop()
    cel.off()
    try {
      const file = files?.item(0)
      if (!file)
        throw new Error('未上传文件')

      const blobUrl = URL.createObjectURL(file)
      await installPlugin(blobUrl)
      URL.revokeObjectURL(blobUrl)
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
  <div class="w-full">
    <div class="pt-3 pl-5 text-2xl mb-2">插件安装</div>
    <NInput v-model:value="inputUrl" class="w-[calc(100%-10px)]! m-1.25" clearable placeholder="输入内容以安装插件"
      :disabled="isAdding" :loading="isAdding" />
    <div class="p-10 flex w-full items-center justify-center gap-4">
      <NButton type="primary" size="large" class="w-1/2!" :loading="isAdding" :disabled="isAdding"
        @click="confirmAdd(inputUrl)">确认
      </NButton>
      <NButton type="primary" secondary size="large" class="" :loading="isAdding" :disabled="isAdding"
        @click="useUploadPlugin">使用本地文件
      </NButton>
    </div>
    <TransitionGroup name="list" tag="ul" class="ml-10 w-full *:my-1 h-1/2 overflow-auto">
      <li name="list" tag="ul" class="w-5/6 flex items-center gap-3 rounded-lg px-2 mx-auto my-4!"
        :class="[inputUrl && 'first:bg-green-300/60']" :key="desc.name"
        v-for="desc of (inputUrl.length == 0) ? pluginInstallers : pluginInstallers.filter(v => v.isMatched(inputUrl))">
        <span class="size-2 rounded-full item-center bg-(--van-text-color) shrink-0" aria-hidden="true"></span>
        <div>
          <div class="van-hairline--bottom text-base font-semibold">
            {{ desc.description.title }}
          </div>
          <div>{{ desc.description.description }}</div>
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>