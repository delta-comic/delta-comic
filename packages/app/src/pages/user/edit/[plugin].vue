<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const $router = useRouter()
const $route = useRoute<'/user/edit/[plugin]'>()
const plugin = computed(() => $route.params.plugin.toString())
const editor = computed(() => uni.user.User.userEditorBase.get(plugin.value))
const { t } = useI18n()
</script>

<template>
  <div
    class="box-content flex h-(--dc-page-header-height) items-center bg-(--dc-surface) px-4 pt-safe"
  >
    <NPageHeader class="w-full" :title="t('common.actions.edit')" @back="$router.back()" />
  </div>
  <NScrollbar
    class="h-[calc(100%-var(--dc-page-header-height)-var(--safe-area-inset-top))]! w-full"
  >
    <div class="mx-auto w-full max-w-5xl">
      <component v-if="editor" :is="editor" />
    </div>
  </NScrollbar>
</template>