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
        <div class="plugin-detail__title grid gap-1">
          <strong>{{ plugin.manifest.name }}</strong>
          <code class="text-muted-foreground text-[10px] font-normal"
            >{{ plugin.manifest.id }} ·
            {{ plugin.installedVersion ?? plugin.manifest.version }}</code
          >
        </div>
      </template>

      <section
        class="plugin-detail__state border-border bg-surface-muted grid grid-cols-2 gap-4 border p-4"
      >
        <div class="grid gap-2">
          <span class="text-muted-foreground text-[11px]">期望状态</span
          ><StatusMark
            :label="plugin.desiredState"
            :tone="plugin.desiredState === 'enabled' ? 'success' : 'muted'"
          />
        </div>
        <div class="grid gap-2">
          <span class="text-muted-foreground text-[11px]">运行状态</span
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

      <div class="plugin-detail__tabs border-border mt-[22px] flex gap-6 border-b">
        <button
          class="text-foreground-secondary cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-xs"
          :class="[tab === 'details' && 'active border-brand text-brand']"
          type="button"
          @click="tab = 'details'"
        >
          详情
        </button>
        <button
          class="text-foreground-secondary cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          :class="[tab === 'config' && 'active border-brand text-brand']"
          type="button"
          :disabled="!plugin.installedVersion"
          @click="tab = 'config'"
        >
          配置
        </button>
        <button
          class="text-foreground-secondary cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          :class="[tab === 'code' && 'active border-brand text-brand']"
          type="button"
          :disabled="!plugin.installedVersion"
          @click="tab = 'code'"
        >
          隔离代码
        </button>
      </div>

      <div v-if="tab === 'details'" class="plugin-detail__content grid gap-6 py-[22px]">
        <section>
          <h3 class="mt-0 mb-2.5 text-xs">描述</h3>
          <p class="text-foreground-secondary m-0 text-xs leading-[1.7]">
            {{ plugin.manifest.description }}
          </p>
        </section>
        <section>
          <h3 class="mt-0 mb-2.5 text-xs">能力</h3>
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
          <h3 class="mt-0 mb-2.5 text-xs">依赖</h3>
          <div
            v-if="plugin.manifest.dependencies.length"
            class="plugin-detail__dependencies border-border border"
          >
            <div
              v-for="dependency in plugin.manifest.dependencies"
              :key="dependency.id"
              class="border-border flex items-center justify-between border-b px-3 py-2.5 last:border-b-0"
            >
              <code class="text-muted-foreground text-[10px]">{{ dependency.id }}</code
              ><span class="text-muted-foreground text-[10px]">{{
                dependency.versionRange ?? '任意版本'
              }}</span>
            </div>
          </div>
          <NEmpty v-else description="无插件依赖" size="small" />
        </section>
        <section>
          <h3 class="mt-0 mb-2.5 text-xs">最近健康</h3>
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
          <span v-else class="plugin-detail__muted text-muted-foreground text-[10px]"
            >尚未执行健康检查</span
          >
        </section>
        <NAlert v-if="plugin.lastError" type="error" title="最近错误">{{
          plugin.lastError
        }}</NAlert>
      </div>

      <NForm
        v-else-if="tab === 'config'"
        class="plugin-detail__content grid gap-6 py-[22px]"
        label-placement="top"
      >
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

      <div v-else class="plugin-detail__content grid gap-6 py-[22px]">
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
          <div class="plugin-detail__script-grid grid grid-cols-2 gap-4">
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
          <NFormItem class="plugin-detail__run-input mt-[18px]" label="手动运行输入（JSON）">
            <NInput v-model:value="scriptDraft.input" type="textarea" :autosize="{ minRows: 3 }" />
          </NFormItem>
          <NButton :loading="scriptPending" :disabled="!script" @click="runCode">立即运行</NButton>
        </NForm>

        <section>
          <h3 class="mt-0 mb-2.5 text-xs">最近运行</h3>
          <NList v-if="scriptRuns?.length" bordered>
            <NListItem v-for="run in scriptRuns" :key="run.id">
              <NThing :title="`${run.trigger} · ${run.status}`">
                <template #description>{{ new Date(run.startedAt).toLocaleString() }}</template>
                <pre
                  class="plugin-detail__run-result bg-surface-muted mt-2 mb-0 overflow-auto p-2.5 text-[10px] whitespace-pre-wrap"
                  >{{ run.errorMessage ?? JSON.stringify(run.result, null, 2) }}</pre
                >
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