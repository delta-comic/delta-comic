<script setup lang="ts">
import { SubscribeDB } from '@delta-comic/db'
import { usePreventBack, DcState } from '@delta-comic/ui'
import { motion } from 'motion-v'
import { NButton, NIcon, NTabPane, NTabs } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Icons } from '@/icons'

import SubList from './subList.vue'

const props = defineProps<{ selectItem: SubscribeDB.AuthorItem }>()
const select = defineModel<string | undefined>('select', { required: true })
const { t } = useI18n()

const { state: subscribe } = SubscribeDB.useQuery(
  async db => (await db.selectAll().execute()) as SubscribeDB.Item[],
)

const { remove } = SubscribeDB.useRemove()
const unsubscribe = (si: SubscribeDB.Item) => {
  select.value = undefined
  return remove({ keys: [si.key] })
}

const isShow = computed({
  get() {
    return !!select.value
  },
  set(v) {
    if (!v) select.value = undefined
  },
})

const activeAuthorKey = computed<string>({
  get: () => select.value ?? props.selectItem.key,
  set: value => {
    select.value = value
  },
})

const getAuthors = (items: SubscribeDB.Item[]) =>
  items.filter((item): item is SubscribeDB.AuthorItem => item.type === 'author')

usePreventBack(isShow)
</script>

<template>
  <AnimatePresence>
    <div class="absolute top-safe left-0 h-15 w-full" @click="select = undefined">
      <DcState :state="subscribe" v-slot="{ data }">
        <template v-for="sub of data" :key="sub.key">
          <motion.div
            v-if="sub.key === select"
            :initial="{ scale: '80%', translateX: '-50%', opacity: 0 }"
            :exit="{ scale: '80%', translateX: '-50%', opacity: 0 }"
            :animate="{ scale: '100%', translateX: '0%', opacity: 1 }"
            class="dc-ellipsis absolute top-1 left-1 flex h-[calc(60px-(var(--spacing)*2))] w-fit max-w-[calc(100%-8px)] items-center gap-2 rounded-2xl bg-(--dc-background-2) px-3 text-nowrap"
          >
            <DcAuthorIcon :size-spacing="10" :author="selectItem.author" />
            <div class="text-lg font-semibold text-(--p-color)">{{ selectItem.author.label }}</div>
          </motion.div>
        </template>
      </DcState>
    </div>
    <motion.div
      class="absolute top-safe-offset-[60px] left-0 h-[calc(100%-60px)] w-full bg-(--dc-background-2)"
      v-if="selectItem"
      :initial="{ translateY: '-30px', opacity: 0 }"
      :exit="{ translateY: '-30px', opacity: 0 }"
      :animate="{ translateY: '0px', opacity: 1 }"
      drag="y"
      :dragConstraints="{ top: 0, right: 0, bottom: 0, left: 0 }"
      :dragTransition="{ bounceStiffness: 500, bounceDamping: 15 }"
      @drag-end="(_, info) => info.offset.y > 100 && (select = undefined)"
    >
      <DcState :state="subscribe" v-slot="{ data: subs }">
        <NTabs v-model:value="activeAuthorKey" animated class="sub-author-tabs size-full!">
          <NTabPane
            v-for="author of getAuthors(subs)"
            :key="author.key"
            :name="author.key"
            :tab="author.author.label"
            display-directive="show:lazy"
            class="size-full!"
          >
            <div
              class="dc-hairline--bottom relative flex h-10 w-full items-center rounded-t-2xl bg-(--dc-background-2) pl-3 text-base font-semibold"
            >
              {{ t('subscription.authorActivity', { author: author.author.label }) }}
              <NButton
                text
                circle
                class="absolute! right-1"
                :aria-label="t('subscription.actions.closeAuthorActivity')"
                @click.stop="select = undefined"
              >
                <template #icon>
                  <NIcon size="25px" color="var(--dc-text-color-3)">
                    <Icons.material.CloseRound />
                  </NIcon>
                </template>
              </NButton>
            </div>
            <div @pointerdown.stop class="h-[calc(100%-40px)] w-full overflow-hidden">
              <SubList @unsubscribe="unsubscribe(author)" :source="author" />
            </div>
          </NTabPane>
        </NTabs>
      </DcState>
    </motion.div>
  </AnimatePresence>
</template>

<style scoped>
.sub-author-tabs :deep(.n-tabs-nav) {
  display: none;
}

.sub-author-tabs :deep(.n-tabs-pane-wrapper),
.sub-author-tabs :deep(.n-tab-pane) {
  height: 100%;
}

.sub-author-tabs :deep(.n-tab-pane) {
  padding: 0;
}
</style>