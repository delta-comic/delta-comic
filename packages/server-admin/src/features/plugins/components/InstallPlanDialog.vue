<script setup lang="ts">
import type { ServerPluginSnapshotEntry } from '@delta-comic/server'
import { computed } from 'vue'

const show = defineModel<boolean>('show', { required: true })
const props = defineProps<{
  allPlugins: ServerPluginSnapshotEntry[]
  plugin?: ServerPluginSnapshotEntry
}>()
const emit = defineEmits<{ confirm: [pluginId: string] }>()

const dependencies = computed(() =>
  (props.plugin?.manifest.dependencies ?? []).map(dependency => ({
    dependency,
    installed: props.allPlugins.find(plugin => plugin.manifest.id === dependency.id),
  })),
)

const confirm = () => {
  if (!props.plugin) return
  emit('confirm', props.plugin.manifest.id)
  show.value = false
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="install-plan w-[min(560px,calc(100vw-32px))]"
    title="安装计划"
    :mask-closable="false"
  >
    <p class="text-foreground-secondary mt-0 mb-[18px] leading-[1.6]">
      安装 {{ plugin?.manifest.name }} {{ plugin?.manifest.version }} 前，将按依赖顺序执行以下计划。
    </p>
    <div class="install-plan__rows border-border mb-[18px] border">
      <div
        v-for="item in dependencies"
        :key="item.dependency.id"
        class="install-plan__row border-border flex items-center justify-between gap-5 border-b px-3.5 py-3 text-xs last:border-b-0"
      >
        <div class="grid gap-[3px]">
          <strong>{{ item.installed?.manifest.name ?? item.dependency.id }}</strong
          ><code class="text-muted-foreground text-[10px]">{{
            item.dependency.versionRange ?? '任意版本'
          }}</code>
        </div>
        <span class="text-muted-foreground text-[10px]">{{
          item.installed?.installedVersion
            ? `已安装 ${item.installed.installedVersion}`
            : '将自动安装'
        }}</span>
      </div>
      <div
        class="install-plan__row install-plan__row--target bg-brand-soft flex items-center justify-between gap-5 px-3.5 py-3 text-xs"
      >
        <div class="grid gap-[3px]">
          <strong>{{ plugin?.manifest.name }}</strong
          ><code class="text-muted-foreground text-[10px]">{{ plugin?.manifest.version }}</code>
        </div>
        <span class="text-muted-foreground text-[10px]">{{
          plugin?.installedVersion ? '更新' : '安装'
        }}</span>
      </div>
    </div>
    <NAlert type="info" :show-icon="false"
      >操作使用持久化 Job 与审计记录；失败不会把插件标记为已启用。</NAlert
    >
    <template #footer>
      <NSpace justify="end"
        ><NButton @click="show = false">取消</NButton
        ><NButton type="primary" @click="confirm">确认安装</NButton></NSpace
      >
    </template>
  </NModal>
</template>