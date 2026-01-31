<script setup lang='ts'>
import { Comp, Store, uni, Utils } from 'delta-comic-core'
import type { FieldInstance } from 'vant'
import { shallowRef } from 'vue'

const config = Store.useConfig()

const $props = defineProps<{
  class?: any
  aim: uni.item.Item | uni.comment.Comment
  item: uni.item.Item
}>()

const show = shallowRef(false)
const input = shallowRef('')
const inputEl = shallowRef<FieldInstance>()
const isSubmitting = shallowRef(false)

const submit = async () => {
  if (input.value == '') return window.$message.info('评论内容不能为空')
  isSubmitting.value = true
  const loading = Utils.message.createLoadingMessage('发送中')
  try {
    await $props.aim.sendComment(input.value)
    loading.success()
  } catch (err) {
    console.error(err)
    loading.fail()
  }
  show.value = false
  input.value = ''
  isSubmitting.value = false
}
</script>

<template>
  <Comp.Popup v-model:show="show" position="bottom" class="w-full bg-(--van-background-2) pb-1" round>
    <VanField type="textarea" class="w-full min-h-[30vh]" autosize v-model="input" placeholder="写下你的留言吧..."
      @click="inputEl?.focus()" ref="inputEl" :disabled="isSubmitting" />
    <div class="w-full h-8 flex items-center justify-end mt-1 pr-1">
      <NButton round type="primary" :loading="isSubmitting" @click="submit()">
        提交
      </NButton>
    </div>
  </Comp.Popup>

  <div class="w-full h-10 bg-(--van-background-2) flex justify-center items-center van-hairline--top" :class @click="async () => {
    if (!item.commentSendable) return
    show = true
    await $nextTick()
    inputEl?.focus()
  }">
    <div :class="[config.isDark ? 'bg-[#333] text-[#666]' : 'bg-gray-100 text-gray-300']"
      class="w-[90%] h-[80%] rounded-full px-2 flex items-center text-xs! van-ellipsis">
      <template v-if="item.commentSendable">
        {{ input || '写下你的留言吧...' }}
      </template>
      <template v-else>
        评论区已关闭
      </template>
    </div>
  </div>
</template>