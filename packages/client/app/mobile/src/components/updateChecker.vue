<script setup lang="ts">
import { Octokit } from '@octokit/rest'
import { computedAsync } from '@vueuse/core'
import { watch, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import pkg from '../../package.json'
import { openExternal } from '../platform'

const oct = new Octokit()
const { t } = useI18n()
const markdown = computedAsync(async onCancel => {
  const { abort, signal } = new AbortController()
  onCancel(() => {
    abort()
  })
  try {
    const releases = await oct.rest.repos.listReleases({
      owner: 'delta-comic',
      repo: 'delta-comic',
      per_page: 20,
      request: { signal },
    })
    return releases.data
      .slice(
        0,
        releases.data.findIndex(v => v.tag_name == pkg.version),
      )
      .filter(v => !v.prerelease && !v.draft)
      .map(r => [r.tag_name, r.body ?? `## ${r.tag_name}`] as const)
  } catch {
    return []
  }
}, [])
const isShow = shallowRef(false)
watch(markdown, markdown => (isShow.value = Boolean(markdown.length)), { immediate: true })
</script>

<template>
  <NModal v-model:show="isShow">
    <div class="max-h-[90vh] min-w-[min(80vw,840px)] rounded-lg bg-(--dc-background) p-3">
      <div class="text-xl font-bold text-[--p-color]">{{ t('update.available') }}</div>
      <DcMarkdown
        :markdown="markdown.map(v => v[1]).join('------\n\n')"
        class="h-[60vh]! w-full pt-3"
      />
      <NButton
        type="primary"
        class="absolute! bottom-2 left-1/2 w-[calc(100%-24px)]! -translate-x-1/2"
        size="small"
        block
        @click="openExternal('https://github.com/delta-comic/delta-comic/releases/latest')"
      >
        {{ t('update.openOnGitHub') }}
      </NButton>
    </div>
  </NModal>
</template>