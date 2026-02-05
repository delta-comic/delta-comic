<script setup lang="ts">
import { LikeOutlined } from '@vicons/antd'
import { ArrowForwardIosRound, ChatBubbleOutlineRound, NearbyErrorRound } from '@vicons/material'
import { computed } from 'vue'
import userIcon from '@/assets/images/userIcon.webp?url'
import { Comp, Store, uni, Utils } from 'delta-comic-core'
import DOMPurify from 'dompurify'
const $props = defineProps<{
  comment: uni.comment.Comment
  parentComment?: uni.comment.Comment
  usernameHighlight?: boolean
}>()
const $emit = defineEmits<{ click: [c: uni.comment.Comment]; clickUser: [u: uni.user.User] }>()
defineSlots<{ default(): void; userExtra(): void }>()

const isParentSender = computed(
  () => $props.comment.sender.name == $props.parentComment?.sender.name
)

const config = Store.useConfig()
</script>

<template>
  <VanRow
    v-bind="$props"
    @click="$emit('click', comment)"
    class="van-hairline--bottom relative bg-(--van-background-2) pb-1 text-(--van-text-color)"
  >
    <VanCol span="4" class="flex! items-start justify-center">
      <div @click.stop="">
        <Comp.Image
          :fallback="userIcon"
          :src="comment.sender.avatar ?? userIcon"
          class="mt-2 size-10"
          round
          fit="cover"
          @click="$emit('clickUser', comment.sender)"
        />
      </div>
    </VanCol>
    <VanCol class="relative ml-1 flex! flex-col" span="19">
      <div class="mt-2 mb-2 flex flex-col" @click.stop="$emit('clickUser', comment.sender)">
        <div class="text-sm text-(--van-text-color)">
          <div
            class="text-sm"
            :class="[
              usernameHighlight || isParentSender
                ? 'font-bold text-(--nui-primary-color)'
                : 'text-(--van-text-color)'
            ]"
          >
            {{ comment.sender.name ?? '' }}
            <span
              class="-translate-y-0.5 rounded bg-(--nui-primary-color) px-0.5 py-0.5 text-[9px] text-white"
              v-if="isParentSender"
              >LZ</span
            >
            <slot name="userExtra"></slot>
          </div>
        </div>
        <span class="text-[11px] text-(--van-text-color-2)">
          {{ Utils.translate.createDateString(comment.$time()) }}
        </span>
      </div>
      <template v-if="comment.reported">
        <div class="h-auto text-wrap text-(--van-text-color-2)">评论被举报</div>
      </template>
      <div v-else>
        <VanTag type="primary" v-if="comment.isTop" plain class="mr-1 inline!">置顶</VanTag>
        <VanTextEllipsis
          rows="3"
          :content="comment.content.text"
          @click-action.stop
          class="inline!"
          v-if="comment.content.type == 'string'"
        >
          <template #action="{ expanded }"
            ><br /><span>{{ expanded ? '收起' : '展开' }}</span></template
          >
        </VanTextEllipsis>
        <div v-else v-html="DOMPurify.sanitize(comment.content.text)"></div>
      </div>

      <div class="mt-2 mb-1 -ml-0.5 flex gap-3">
        <Comp.ToggleIcon
          :icon="LikeOutlined"
          row-mode
          v-model="comment.isLiked"
          @change="comment.like()"
          size="16px"
        >
          {{ comment.likeCount + (comment.isLiked ? 1 : 0) || '' }}
        </Comp.ToggleIcon>
        <Comp.ToggleIcon
          :icon="ChatBubbleOutlineRound"
          row-mode
          dis-changed
          size="16px"
          class="font-bold"
        >
          {{ comment.childrenCount || '' }}
        </Comp.ToggleIcon>
        <NPopconfirm
          @positive-click="
            () => {
              Utils.message.createLoadingMessage().bind(comment.report())
            }
          "
        >
          <template #trigger>
            <NButton @click.stop text icon class="flex items-center">
              <template #icon>
                <NIcon size="16px">
                  <NearbyErrorRound />
                </NIcon>
              </template>
            </NButton>
          </template>
          确定举报?
        </NPopconfirm>
        <slot />
      </div>

      <div
        v-if="comment.childrenCount > 0 && !isParentSender"
        :class="[config.isDark ? 'bg-white/10!' : 'bg-(--van-gray-2)/80']"
        class="pointer-events-none mt-1 mb-3 flex h-9 w-full items-center rounded text-(--nui-primary-color)"
      >
        <span class="ml-2 text-[13px]">共{{ comment.childrenCount }}条回复</span>
        <NIcon size="11px" class="ml-1">
          <ArrowForwardIosRound />
        </NIcon>
      </div>
    </VanCol>
  </VanRow>
</template>