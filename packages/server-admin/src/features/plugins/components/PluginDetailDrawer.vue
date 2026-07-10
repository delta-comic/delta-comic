<script setup lang="ts">
import type {
  ServerPluginAction,
  ServerPluginConfig,
  ServerPluginConfigChoice,
  ServerPluginConfigValue,
  ServerPluginSnapshotEntry,
} from '@delta-comic/server'
import { shallowRef, watch } from 'vue'

import StatusMark from '@/shared/components/StatusMark.vue'

const show = defineModel<boolean>('show', { required: true })
const props = defineProps<{ pending?: ServerPluginAction; plugin?: ServerPluginSnapshotEntry }>()
const emit = defineEmits<{
  action: [plugin: ServerPluginSnapshotEntry, action: ServerPluginAction]
  configure: [pluginId: string, config: ServerPluginConfig]
}>()

const tab = shallowRef<'config' | 'details'>('details')
const draft = shallowRef<ServerPluginConfig>({})

watch(
  () => props.plugin,
  plugin => {
    draft.value = { ...plugin?.config }
    tab.value = 'details'
  },
  { immediate: true },
)

const setField = (key: string, value: ServerPluginConfigValue) => {
  draft.value = { ...draft.value, [key]: value }
}

const choiceOptions = (choices: readonly ServerPluginConfigChoice[]) =>
  choices.map((choice, index) => ({ label: choice.label, value: String(index) }))

const selectedChoice = (
  choices: readonly ServerPluginConfigChoice[],
  value: ServerPluginConfigValue | undefined,
): string | null => {
  const index = choices.findIndex(choice => Object.is(choice.value, value))
  return index < 0 ? null : String(index)
}

const setChoice = (key: string, choices: readonly ServerPluginConfigChoice[], index: string) => {
  const choice = choices[Number(index)]
  if (choice) setField(key, choice.value)
}

const can = (action: ServerPluginAction): boolean =>
  Boolean(props.plugin?.allowedActions.includes(action))
</script>

<template>
  <NDrawer v-model:show="show" :width="520" placement="right" :trap-focus="true">
    <NDrawerContent v-if="plugin" closable>
      <template #header>
        <div class="plugin-detail__title">
          <strong>{{ plugin.manifest.name }}</strong>
          <code
            >{{ plugin.manifest.id }} ·
            {{ plugin.installedVersion ?? plugin.manifest.version }}</code
          >
        </div>
      </template>

      <section class="plugin-detail__state">
        <div>
          <span>期望状态</span
          ><StatusMark
            :label="plugin.desiredState"
            :tone="plugin.desiredState === 'enabled' ? 'success' : 'muted'"
          />
        </div>
        <div>
          <span>运行状态</span
          ><StatusMark
            :label="plugin.observedState"
            :tone="
              plugin.observedState === 'enabled'
                ? 'success'
                : plugin.observedState === 'failed'
                  ? 'danger'
                  : 'warning'
            "
          />
        </div>
      </section>

      <div class="plugin-detail__tabs">
        <button :class="{ active: tab === 'details' }" type="button" @click="tab = 'details'">
          详情
        </button>
        <button
          :class="{ active: tab === 'config' }"
          type="button"
          :disabled="!plugin.installedVersion"
          @click="tab = 'config'"
        >
          配置
        </button>
      </div>

      <div v-if="tab === 'details'" class="plugin-detail__content">
        <section>
          <h3>描述</h3>
          <p>{{ plugin.manifest.description }}</p>
        </section>
        <section>
          <h3>能力</h3>
          <NSpace
            ><NTag
              v-for="capability in plugin.manifest.capabilities"
              :key="capability"
              size="small"
              >{{ capability }}</NTag
            ></NSpace
          >
        </section>
        <section>
          <h3>依赖</h3>
          <div v-if="plugin.manifest.dependencies.length" class="plugin-detail__dependencies">
            <div v-for="dependency in plugin.manifest.dependencies" :key="dependency.id">
              <code>{{ dependency.id }}</code
              ><span>{{ dependency.versionRange ?? '任意版本' }}</span>
            </div>
          </div>
          <NEmpty v-else description="无插件依赖" size="small" />
        </section>
        <section>
          <h3>最近健康</h3>
          <template v-if="plugin.lastHealth">
            <StatusMark
              :label="plugin.lastHealth.message"
              :tone="
                plugin.lastHealth.status === 'healthy'
                  ? 'success'
                  : plugin.lastHealth.status === 'degraded'
                    ? 'warning'
                    : 'danger'
              "
            />
          </template>
          <span v-else class="plugin-detail__muted">尚未执行健康检查</span>
        </section>
        <NAlert v-if="plugin.lastError" type="error" title="最近错误">{{
          plugin.lastError
        }}</NAlert>
      </div>

      <NForm v-else class="plugin-detail__content" label-placement="top">
        <NFormItem
          v-for="(field, key) in plugin.manifest.configSchema.properties"
          :key="key"
          :label="field.label"
          :feedback="field.description"
        >
          <NSelect
            v-if="field.choices"
            :value="selectedChoice(field.choices, draft[String(key)])"
            :options="choiceOptions(field.choices)"
            @update:value="(value: string) => setChoice(String(key), field.choices!, value)"
          />
          <NSwitch
            v-else-if="field.type === 'boolean'"
            :value="Boolean(draft[String(key)])"
            @update:value="(value: boolean) => setField(String(key), value)"
          />
          <NInputNumber
            v-else-if="field.type === 'number'"
            :value="typeof draft[String(key)] === 'number' ? (draft[String(key)] as number) : null"
            :min="field.minimum"
            :max="field.maximum"
            @update:value="(value: number | null) => setField(String(key), value)"
          />
          <NInput
            v-else
            :value="typeof draft[String(key)] === 'string' ? (draft[String(key)] as string) : ''"
            :maxlength="field.maxLength"
            @update:value="value => setField(String(key), value)"
          />
        </NFormItem>
        <NButton
          type="primary"
          :loading="pending === 'configure'"
          @click="emit('configure', plugin.manifest.id, draft)"
          >保存配置</NButton
        >
      </NForm>

      <template #footer>
        <NSpace justify="space-between">
          <NButton
            v-if="can('uninstall')"
            type="error"
            ghost
            :loading="pending === 'uninstall'"
            @click="emit('action', plugin, 'uninstall')"
            >卸载</NButton
          >
          <NSpace>
            <NButton
              v-if="can('health')"
              :loading="pending === 'health'"
              @click="emit('action', plugin, 'health')"
              >健康检查</NButton
            >
            <NButton
              v-if="can('disable')"
              :loading="pending === 'disable'"
              @click="emit('action', plugin, 'disable')"
              >停用</NButton
            >
            <NButton
              v-if="can('enable')"
              type="primary"
              :loading="pending === 'enable'"
              @click="emit('action', plugin, 'enable')"
              >启用</NButton
            >
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.plugin-detail__title {
  display: grid;
  gap: 4px;
}

.plugin-detail__title code {
  color: var(--dc-text-muted);
  font-size: 10px;
  font-weight: 400;
}

.plugin-detail__state {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
  background: var(--dc-surface-soft);
  border: 1px solid var(--dc-border);
}

.plugin-detail__state > div {
  display: grid;
  gap: 8px;
}

.plugin-detail__state > div > span {
  color: var(--dc-text-muted);
  font-size: 11px;
}

.plugin-detail__tabs {
  display: flex;
  gap: 24px;
  margin-top: 22px;
  border-bottom: 1px solid var(--dc-border);
}

.plugin-detail__tabs button {
  padding: 10px 2px;
  color: var(--dc-text-secondary);
  font-size: 12px;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.plugin-detail__tabs button.active {
  color: var(--dc-blue);
  border-color: var(--dc-blue);
}

.plugin-detail__content {
  display: grid;
  gap: 24px;
  padding: 22px 0;
}

.plugin-detail__content h3 {
  margin: 0 0 10px;
  font-size: 12px;
}

.plugin-detail__content p {
  margin: 0;
  color: var(--dc-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.plugin-detail__dependencies {
  border: 1px solid var(--dc-border);
}

.plugin-detail__dependencies > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dc-border);
}

.plugin-detail__dependencies > div:last-child {
  border-bottom: 0;
}

.plugin-detail__dependencies code,
.plugin-detail__dependencies span,
.plugin-detail__muted {
  color: var(--dc-text-muted);
  font-size: 10px;
}
</style>