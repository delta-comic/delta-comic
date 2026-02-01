<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { Comp, uni } from 'delta-comic-core'
const $props = defineProps<{ item: uni.item.Item }>()
const floatPopup = useTemplateRef('floatPopup')
const parentComment = shallowRef<uni.comment.Comment>()
defineExpose({
  loadChild(parent: uni.comment.Comment) {
    parentComment.value = parent
    floatPopup.value?.show()
  }
})
defineEmits<{ user: [u: uni.user.User] }>()
const CommentRow = computed(() => uni.comment.Comment.commentRow.get($props.item.contentType))
</script>

<template>
  <Comp.FloatPopup anchors="high" lock-scroll ref="floatPopup" overlay class="**:overflow-x-hidden">
    <Comp.Waterfall
      :source="parentComment.children"
      :padding="0"
      :col="1"
      :gap="0"
      v-if="parentComment"
      v-slot="{ item: comment }"
      class="h-[calc(100%-40px)]! bg-(--van-background)"
      :data-processor="v => (parentComment ? [parentComment, ...v] : v)"
    >
      <component
        :is="CommentRow"
        :parentComment
        :comment
        :item
        @click-user="$emit('user', $event)"
      />
    </Comp.Waterfall>
    <Sender :item :aim="parentComment" v-if="parentComment" />
  </Comp.FloatPopup>
</template>