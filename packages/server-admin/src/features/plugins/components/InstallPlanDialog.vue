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
    class="install-plan"
    title="安装计划"
    :mask-closable="false"
  >
    <p>
      安装 {{ plugin?.manifest.name }} {{ plugin?.manifest.version }} 前，将按依赖顺序执行以下计划。
    </p>
    <div class="install-plan__rows">
      <div v-for="item in dependencies" :key="item.dependency.id" class="install-plan__row">
        <div>
          <strong>{{ item.installed?.manifest.name ?? item.dependency.id }}</strong
          ><code>{{ item.dependency.versionRange ?? '任意版本' }}</code>
        </div>
        <span>{{
          item.installed?.installedVersion
            ? `已安装 ${item.installed.installedVersion}`
            : '将自动安装'
        }}</span>
      </div>
      <div class="install-plan__row install-plan__row--target">
        <div>
          <strong>{{ plugin?.manifest.name }}</strong
          ><code>{{ plugin?.manifest.version }}</code>
        </div>
        <span>{{ plugin?.installedVersion ? '更新' : '安装' }}</span>
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

<style scoped>
.install-plan {
  width: min(560px, calc(100vw - 32px));
}

.install-plan p {
  margin: 0 0 18px;
  color: var(--dc-text-secondary);
  line-height: 1.6;
}

.install-plan__rows {
  margin-bottom: 18px;
  border: 1px solid var(--dc-border);
}

.install-plan__row {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 12px;
  border-bottom: 1px solid var(--dc-border);
}

.install-plan__row:last-child {
  border-bottom: 0;
}

.install-plan__row > div {
  display: grid;
  gap: 3px;
}

.install-plan__row code,
.install-plan__row span {
  color: var(--dc-text-muted);
  font-size: 10px;
}

.install-plan__row--target {
  background: var(--dc-blue-soft);
}
</style>