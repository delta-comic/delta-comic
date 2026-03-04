<script setup lang="ts">
import { Octokit } from '@octokit/rest'
import { open } from '@tauri-apps/plugin-shell'
import { computedAsync } from '@vueuse/core'
import { watch, shallowRef } from 'vue'

import pkg from '../../package.json'

const oct = new Octokit()
const markdown = computedAsync(async () => {
  // if (import.meta.env.DEV) return []
  try {
    const releases = await oct.rest.repos.listReleases({
      owner: 'delta-comic',
      repo: 'delta-comic',
      per_page: 20
    })
    return releases.data
      .slice(
        0,
        releases.data.findIndex(v => v.tag_name == pkg.version)
      )
      .map(r => [r.tag_name, r.body ?? `## ${r.tag_name}`] as const)
  } catch {
    return []
  }
}, [])
const isShow = shallowRef(false)
watch(markdown, markdown => (isShow.value = Boolean(markdown.length)), { immediate: true })
</script>

<template>
  <DcPopup v-model:show="isShow" round position="center" class="max-h-[90vh] min-w-[80vw] p-3">
    <div class="text-xl font-bold text-[--p-color]">发现新版本</div>
    <DcMarkdown
      :markdown="markdown.map(v => v[1]).join('------\n\n')"
      class="h-[60vh]! w-full pt-3"
    />
    <VanButton
      type="primary"
      class="absolute bottom-2 left-1/2 w-[calc(100%-24px)] -translate-x-1/2"
      size="small"
      block
      @click="open('https://github.com/delta-comic/delta-comic/releases/latest')"
    >
      在github打开
    </VanButton>
  </DcPopup>
</template>