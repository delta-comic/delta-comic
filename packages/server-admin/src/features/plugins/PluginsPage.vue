<script setup lang="ts">
import type {
  ServerPluginAction,
  ServerPluginConfig,
  ServerPluginScript,
  ServerPluginSnapshotEntry,
} from '@delta-comic/server'
import { useDialog, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import AppIcon from '@/shared/components/AppIcon.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useConnectionStore } from '@/stores/connection'
import { usePluginsStore } from '@/stores/plugins'

import InstallPlanDialog from './components/InstallPlanDialog.vue'
import PluginActivityPanel from './components/PluginActivityPanel.vue'
import PluginDetailDrawer from './components/PluginDetailDrawer.vue'
import PluginTable from './components/PluginTable.vue'

const route = useRoute()
const dialog = useDialog()
const message = useMessage()
const connection = useConnectionStore()
const store = usePluginsStore()
const {
  error,
  loading,
  pending,
  plugins,
  script,
  scriptPending,
  scriptRuns,
  selected,
  selectedId,
  snapshot,
} = storeToRefs(store)
const { load, loadScript, runAction, runScript, saveScript, select } = store

const tab = shallowRef<'activity' | 'available' | 'installed'>(
  route.query.tab === 'activity' ? 'activity' : 'installed',
)
const search = shallowRef('')
const stateFilter = shallowRef('all')
const drawerOpen = shallowRef(false)
const planOpen = shallowRef(false)
const planPlugin = shallowRef<ServerPluginSnapshotEntry>()

const listed = computed(() => {
  const source =
    tab.value === 'available'
      ? plugins.value.filter(plugin => !plugin.installedVersion)
      : plugins.value.filter(plugin => Boolean(plugin.installedVersion))
  const keyword = search.value.trim().toLowerCase()
  return source.filter(plugin => {
    const matchesSearch =
      !keyword || `${plugin.manifest.name} ${plugin.manifest.id}`.toLowerCase().includes(keyword)
    const matchesState = stateFilter.value === 'all' || plugin.observedState === stateFilter.value
    return matchesSearch && matchesState
  })
})

const openPlugin = (pluginId: string) => {
  select(pluginId)
  drawerOpen.value = true
  void loadScript(pluginId)
}

const savePluginScript = async (
  pluginId: string,
  input: Pick<ServerPluginScript, 'enabled' | 'intervalHours' | 'source'>,
) => {
  if (await saveScript(pluginId, input)) message.success('插件代码已保存')
}

const executePluginScript = async (pluginId: string, input: unknown) => {
  const result = await runScript(pluginId, input)
  if (!result) return
  if (result.status === 'succeeded') message.success('插件代码运行完成')
  else message.error(result.errorMessage ?? '插件代码运行失败')
}

const execute = async (
  pluginId: string,
  action: ServerPluginAction,
  config?: ServerPluginConfig,
) => {
  const job = await runAction(pluginId, action, config)
  if (job?.status === 'succeeded') message.success(`${action} 操作已完成`)
}

const requestAction = (plugin: ServerPluginSnapshotEntry, action: ServerPluginAction) => {
  if (action === 'install' || action === 'update') {
    planPlugin.value = plugin
    planOpen.value = true
    return
  }
  if (action === 'uninstall') {
    dialog.warning({
      title: '确认卸载插件',
      content: `将停用并移除 ${plugin.manifest.name} 的安装与注册记录。存在已安装依赖方时服务端会拒绝操作。`,
      positiveText: '确认卸载',
      negativeText: '取消',
      onPositiveClick: () => execute(plugin.manifest.id, 'uninstall'),
    })
    return
  }
  void execute(plugin.manifest.id, action)
}

onMounted(() => {
  if (connection.hasCredentials) void load()
})
</script>

<template>
  <div class="admin-page plugins-page max-w-[1600px]">
    <PageHeader title="插件中心" description="统一管理注册、安装、配置与运行状态">
      <template #actions>
        <NButton :loading="loading" secondary @click="load">
          <template #icon><AppIcon name="refresh" :size="17" /></template>刷新
        </NButton>
      </template>
    </PageHeader>

    <div class="plugins-page__tabs border-border mb-5 flex gap-[26px] border-b" role="tablist">
      <button
        class="text-foreground-secondary cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0.5 py-[11px] text-[13px]"
        type="button"
        :class="[tab === 'available' && 'active border-brand text-brand font-[620]']"
        @click="tab = 'available'"
      >
        可注册
      </button>
      <button
        class="text-foreground-secondary cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0.5 py-[11px] text-[13px]"
        type="button"
        :class="[tab === 'installed' && 'active border-brand text-brand font-[620]']"
        @click="tab = 'installed'"
      >
        已安装
      </button>
      <button
        class="text-foreground-secondary cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0.5 py-[11px] text-[13px]"
        type="button"
        :class="[tab === 'activity' && 'active border-brand text-brand font-[620]']"
        @click="tab = 'activity'"
      >
        任务与审计
      </button>
    </div>

    <div v-if="error" class="admin-error plugins-page__error mb-4">{{ error }}</div>
    <NResult
      v-if="!connection.hasCredentials"
      status="info"
      title="尚未连接 Server API"
      description="插件控制面需要管理员令牌。"
    >
      <template #footer
        ><NButton type="primary" @click="$router.push('/settings')">打开设置</NButton></template
      >
    </NResult>

    <PluginActivityPanel
      v-else-if="tab === 'activity'"
      :audit="snapshot?.recentAudit ?? []"
      :jobs="snapshot?.recentJobs ?? []"
    />
    <section v-else class="admin-panel plugins-page__panel">
      <div
        class="plugins-page__filters border-border grid grid-cols-[minmax(240px,360px)_160px] gap-3 border-b p-4 max-sm:grid-cols-1"
      >
        <NInput v-model:value="search" clearable placeholder="搜索插件">
          <template #prefix><AppIcon name="search" :size="16" /></template>
        </NInput>
        <NSelect
          v-model:value="stateFilter"
          :options="[
            { label: '全部状态', value: 'all' },
            { label: '运行中', value: 'enabled' },
            { label: '已停用', value: 'disabled' },
            { label: '异常', value: 'failed' },
            { label: '已注册', value: 'registered' },
          ]"
        />
      </div>
      <PluginTable
        :entries="listed"
        :pending="pending"
        :selected-id="selectedId"
        @action="requestAction"
        @select="openPlugin"
      />
    </section>

    <InstallPlanDialog
      v-model:show="planOpen"
      :all-plugins="plugins"
      :plugin="planPlugin"
      @confirm="pluginId => execute(pluginId, planPlugin?.updateAvailable ? 'update' : 'install')"
    />
    <PluginDetailDrawer
      v-model:show="drawerOpen"
      :pending="selected ? pending[selected.manifest.id] : undefined"
      :plugin="selected"
      :script="script"
      :script-pending="scriptPending"
      :script-runs="scriptRuns"
      @action="requestAction"
      @configure="(pluginId, config) => execute(pluginId, 'configure', config)"
      @run-script="executePluginScript"
      @save-script="savePluginScript"
    />
  </div>
</template>