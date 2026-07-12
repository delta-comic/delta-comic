<script setup lang="ts">
import type {
  ServerPluginAction,
  ServerPluginConfig,
  ServerPluginConfigChoice,
  ServerPluginConfigValue,
  ServerPluginScript,
  ServerPluginScriptRun,
  ServerPluginSnapshotEntry,
} from '@delta-comic/server'
import { reactive, shallowRef, watch } from 'vue'

import StatusMark from '@/shared/components/StatusMark.vue'

const show = defineModel<boolean>('show', { required: true })
const props = defineProps<{
  pending?: ServerPluginAction
  plugin?: ServerPluginSnapshotEntry
  script?: ServerPluginScript | null
  scriptPending?: boolean
  scriptRuns?: ServerPluginScriptRun[]
}>()
const emit = defineEmits<{
  action: [plugin: ServerPluginSnapshotEntry, action: ServerPluginAction]
  configure: [pluginId: string, config: ServerPluginConfig]
  runScript: [pluginId: string, input: unknown]
  saveScript: [
    pluginId: string,
    input: Pick<ServerPluginScript, 'enabled' | 'intervalHours' | 'source'>,
  ]
}>()

const tab = shallowRef<'code' | 'config' | 'details'>('details')
const draft = shallowRef<ServerPluginConfig>({})
const scriptDraft = reactive({
  enabled: false,
  input: '{}',
  intervalHours: 1,
  source: 'return { pluginId: context.pluginId, input, trigger: context.trigger }',
})

watch(
  () => props.plugin,
  plugin => {
    draft.value = { ...plugin?.config }
    tab.value = 'details'
  },
  { immediate: true },
)

watch(
  () => props.script,
  script => {
    scriptDraft.enabled = script?.enabled ?? false
    scriptDraft.intervalHours = script?.intervalHours ?? 1
    scriptDraft.source =
      script?.source ?? 'return { pluginId: context.pluginId, input, trigger: context.trigger }'
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

const runCode = () => {
  if (!props.plugin) return
  let input: unknown
  try {
    input = JSON.parse(scriptDraft.input)
  } catch {
    input = scriptDraft.input
  }
  emit('runScript', props.plugin.manifest.id, input)
}
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
        <button
          :class="{ active: tab === 'code' }"
          type="button"
          :disabled="!plugin.installedVersion"
          @click="tab = 'code'"
        >
          隔离代码
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

      <NForm v-else-if="tab === 'config'" class="plugin-detail__content" label-placement="top">
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

      <div v-else class="plugin-detail__content">
        <NAlert type="warning" title="隔离执行">
          代码在 Dynamic Worker 中运行，无网络访问，CPU 上限 50ms；计划任务最小粒度为一小时。
        </NAlert>
        <NForm label-placement="top">
          <NFormItem label="函数体">
            <NInput
              v-model:value="scriptDraft.source"
              type="textarea"
              :autosize="{ minRows: 12, maxRows: 24 }"
              placeholder="使用 input 和只读 context，并通过 return 返回 JSON 值"
            />
          </NFormItem>
          <div class="plugin-detail__script-grid">
            <NFormItem label="启用计划任务">
              <NSwitch v-model:value="scriptDraft.enabled" />
            </NFormItem>
            <NFormItem label="运行间隔（小时）">
              <NInputNumber v-model:value="scriptDraft.intervalHours" :min="1" :max="168" />
            </NFormItem>
          </div>
          <NSpace>
            <NButton
              type="primary"
              :loading="scriptPending"
              @click="
                emit('saveScript', plugin.manifest.id, {
                  enabled: scriptDraft.enabled,
                  intervalHours: scriptDraft.intervalHours,
                  source: scriptDraft.source,
                })
              "
            >
              保存代码
            </NButton>
          </NSpace>
          <NFormItem class="plugin-detail__run-input" label="手动运行输入（JSON）">
            <NInput v-model:value="scriptDraft.input" type="textarea" :autosize="{ minRows: 3 }" />
          </NFormItem>
          <NButton :loading="scriptPending" :disabled="!script" @click="runCode">立即运行</NButton>
        </NForm>

        <section>
          <h3>最近运行</h3>
          <NList v-if="scriptRuns?.length" bordered>
            <NListItem v-for="run in scriptRuns" :key="run.id">
              <NThing :title="`${run.trigger} · ${run.status}`">
                <template #description>{{ new Date(run.startedAt).toLocaleString() }}</template>
                <pre class="plugin-detail__run-result">{{
                  run.errorMessage ?? JSON.stringify(run.result, null, 2)
                }}</pre>
              </NThing>
            </NListItem>
          </NList>
          <NEmpty v-else description="尚无代码运行记录" size="small" />
        </section>
      </div>

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
  @apply [display:grid];
  @apply [gap:4px];
}

.plugin-detail__title code {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:10px];
  @apply [font-weight:400];
}

.plugin-detail__state {
  @apply [display:grid];
  @apply [grid-template-columns:1fr_1fr];
  @apply [gap:16px];
  @apply [padding:16px];
  @apply [background:var(--dc-surface-soft)];
  @apply [border:1px_solid_var(--dc-border)];
}

.plugin-detail__state > div {
  @apply [display:grid];
  @apply [gap:8px];
}

.plugin-detail__state > div > span {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:11px];
}

.plugin-detail__tabs {
  @apply [display:flex];
  @apply [gap:24px];
  @apply [margin-top:22px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.plugin-detail__tabs button {
  @apply [padding:10px_2px];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:12px];
  @apply [background:transparent];
  @apply [border:0];
  @apply [border-bottom:2px_solid_transparent];
  @apply [cursor:pointer];
}

.plugin-detail__tabs button.active {
  @apply [color:var(--dc-blue)];
  @apply [border-color:var(--dc-blue)];
}

.plugin-detail__content {
  @apply [display:grid];
  @apply [gap:24px];
  @apply [padding:22px_0];
}

.plugin-detail__content h3 {
  @apply [margin:0_0_10px];
  @apply [font-size:12px];
}

.plugin-detail__content p {
  @apply [margin:0];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:12px];
  @apply [line-height:1.7];
}

.plugin-detail__dependencies {
  @apply [border:1px_solid_var(--dc-border)];
}

.plugin-detail__dependencies > div {
  @apply [display:flex];
  @apply [align-items:center];
  @apply [justify-content:space-between];
  @apply [padding:10px_12px];
  @apply [border-bottom:1px_solid_var(--dc-border)];
}

.plugin-detail__dependencies > div:last-child {
  @apply [border-bottom:0];
}

.plugin-detail__dependencies code,
.plugin-detail__dependencies span,
.plugin-detail__muted {
  @apply [color:var(--dc-text-muted)];
  @apply [font-size:10px];
}

.plugin-detail__script-grid {
  @apply [display:grid];
  @apply [grid-template-columns:1fr_1fr];
  @apply [gap:16px];
}

.plugin-detail__run-input {
  @apply [margin-top:18px];
}

.plugin-detail__run-result {
  @apply [overflow:auto];
  @apply [margin:8px_0_0];
  @apply [padding:10px];
  @apply [background:var(--dc-surface-soft)];
  @apply [font-size:10px];
  @apply [white-space:pre-wrap];
}
</style>