<script setup lang="ts">
import pkg from '../../package.json'
import { Octokit } from '@octokit/rest'
import { computedAsync } from '@vueuse/core'
import { watch, shallowRef } from 'vue'
import VueMarkdown from 'vue-markdown-render'
import { open } from '@tauri-apps/plugin-shell'

const oct = new Octokit()
const markdown = computedAsync(async () => {
  if (import.meta.env.DEV) return []
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
  <DcPopup
    v-model:show="isShow"
    round
    position="center"
    class="max-h-[90vh] min-h-[80vw] w-[70%] p-3"
  >
    <div class="text-xl font-bold text-[--p-color]">发现新版本</div>
    <NScrollbar>
      <VueMarkdown
        :source="markdown.map(v => v[1]).join('------\n\n')"
        class="markdown max-h-[70vh]!"
      />
    </NScrollbar>
    <VanButton
      type="primary"
      class="absolute bottom-3 left-1/2 w-[calc(100%-24px)] -translate-x-1/2"
      size="small"
      block
      @click="open('https://github.com/delta-comic/delta-comic/releases/latest')"
    >
      在github打开
    </VanButton>
  </DcPopup>
</template>