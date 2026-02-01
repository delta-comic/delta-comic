<script setup lang="ts">
import { Comp, uni, Utils } from 'delta-comic-core'
import { computed, useTemplateRef } from 'vue'
import _CommentRow from './commentRow.vue'

const $props = defineProps<{
  item: uni.item.Item
  comments: Utils.data.RStream<uni.comment.Comment>
  class?: any
}>()
const CommentRow = computed(
  () => uni.comment.Comment.commentRow.get($props.item.contentType) ?? _CommentRow
)

const children = useTemplateRef('children')

const previewUser = useTemplateRef('previewUser')
</script>

<template>
  <template v-if="item.commentSendable">
    <div class="w-full overflow-hidden bg-(--van-background)" :class="$props.class ?? 'non-height'">
      <Comp.Waterfall
        :source="comments"
        ref="waterfall"
        class="h-[calc(100%-40px)]!"
        v-slot="{ item: comment }"
        :col="1"
        :gap="0"
        :padding="0"
      >
        <component
          :is="CommentRow"
          :comment
          :item
          @clickUser="(user: uni.user.User) => previewUser?.show(user)"
          @click="children?.loadChild(comment)"
        />
      </Comp.Waterfall>
      <Sender :item :aim="item" />
    </div>
    <Children :item ref="children" @user="user => previewUser?.show(user)" />
  </template>
  <div
    v-else
    class="h-[calc(70vh-var(--van-tabs-line-height))] w-full pt-2 text-center text-(--van-text-color-2)"
  >
    评论区已关闭
  </div>
  <PreviewUser ref="previewUser" />
</template>