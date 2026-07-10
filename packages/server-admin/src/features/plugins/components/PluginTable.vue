<script setup lang="ts">
import type { ServerPluginAction, ServerPluginSnapshotEntry } from '@delta-comic/server'

import StatusMark from '@/shared/components/StatusMark.vue'

defineProps<{
  entries: ServerPluginSnapshotEntry[]
  pending: Record<string, ServerPluginAction>
  selectedId: string
}>()

const emit = defineEmits<{
  action: [plugin: ServerPluginSnapshotEntry, action: ServerPluginAction]
  select: [pluginId: string]
}>()

const stateLabel: Record<ServerPluginSnapshotEntry['observedState'], string> = {
  available: '可注册',
  disabled: '已停用',
  enabled: '运行中',
  failed: '异常',
  installed: '已安装',
  registered: '已注册',
}

const stateTone = (state: ServerPluginSnapshotEntry['observedState']) => {
  if (state === 'enabled') return 'success' as const
  if (state === 'failed') return 'danger' as const
  if (state === 'installed' || state === 'registered') return 'warning' as const
  return 'muted' as const
}

const primaryAction = (plugin: ServerPluginSnapshotEntry): ServerPluginAction | undefined => {
  const priority: ServerPluginAction[] = ['register', 'install', 'update', 'enable', 'disable']
  return priority.find(action => plugin.allowedActions.includes(action))
}

const actionLabel: Partial<Record<ServerPluginAction, string>> = {
  disable: '停用',
  enable: '启用',
  install: '安装',
  register: '注册',
  update: '更新',
}
</script>

<template>
  <div class="plugin-table-wrap">
    <table v-if="entries.length" class="plugin-table">
      <thead>
        <tr>
          <th>插件名称</th>
          <th>版本</th>
          <th>能力</th>
          <th>期望状态</th>
          <th>运行状态</th>
          <th>最近健康</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="plugin in entries"
          :key="plugin.manifest.id"
          :class="{ 'plugin-table__row--selected': selectedId === plugin.manifest.id }"
          @click="emit('select', plugin.manifest.id)"
        >
          <td>
            <strong>{{ plugin.manifest.name }}</strong>
            <code>{{ plugin.manifest.id }}</code>
          </td>
          <td>{{ plugin.installedVersion ?? plugin.manifest.version }}</td>
          <td>
            <div class="plugin-table__capabilities">
              <NTag
                v-for="capability in plugin.manifest.capabilities.slice(0, 3)"
                :key="capability"
                size="small"
                :bordered="false"
              >
                {{ capability }}
              </NTag>
            </div>
          </td>
          <td>
            {{
              plugin.desiredState === 'enabled'
                ? '启用'
                : plugin.desiredState === 'disabled'
                  ? '停用'
                  : '未安装'
            }}
          </td>
          <td>
            <StatusMark
              :label="stateLabel[plugin.observedState]"
              :tone="stateTone(plugin.observedState)"
            />
          </td>
          <td>
            <StatusMark
              v-if="plugin.lastHealth"
              :label="
                plugin.lastHealth.status === 'healthy'
                  ? '健康'
                  : plugin.lastHealth.status === 'degraded'
                    ? '降级'
                    : '不可用'
              "
              :tone="
                plugin.lastHealth.status === 'healthy'
                  ? 'success'
                  : plugin.lastHealth.status === 'degraded'
                    ? 'warning'
                    : 'danger'
              "
            />
            <span v-else class="plugin-table__muted">—</span>
          </td>
          <td @click.stop>
            <NSpace :wrap="false" size="small">
              <NButton
                v-if="primaryAction(plugin)"
                size="tiny"
                :type="primaryAction(plugin) === 'disable' ? 'default' : 'primary'"
                :loading="Boolean(pending[plugin.manifest.id])"
                @click="emit('action', plugin, primaryAction(plugin)!)"
                >{{ actionLabel[primaryAction(plugin)!] }}</NButton
              >
              <NButton size="tiny" quaternary @click="emit('select', plugin.manifest.id)"
                >详情</NButton
              >
            </NSpace>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="dc-empty">没有符合当前条件的插件</div>
  </div>
</template>

<style scoped>
.plugin-table-wrap {
  overflow-x: auto;
}

.plugin-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 12px;
}

.plugin-table th,
.plugin-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid var(--dc-border);
}

.plugin-table th {
  color: var(--dc-text-secondary);
  font-size: 11px;
  font-weight: 600;
  background: var(--dc-surface-soft);
}

.plugin-table tbody tr {
  cursor: pointer;
}

.plugin-table tbody tr:hover,
.plugin-table__row--selected {
  background: #f3f7ff;
}

.plugin-table td:first-child {
  display: grid;
  min-width: 190px;
  gap: 4px;
}

.plugin-table strong {
  color: var(--dc-text);
  font-size: 12px;
}

.plugin-table code,
.plugin-table__muted {
  color: var(--dc-text-muted);
  font-size: 10px;
}

.plugin-table__capabilities {
  display: flex;
  max-width: 260px;
  gap: 4px;
  flex-wrap: wrap;
}
</style>