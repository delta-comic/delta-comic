<script setup lang="ts">
import { parseFlowDocument, type FlowInstallation } from '@delta-comic/server'
import { parsePluginManifest } from '@delta-comic/shared-plugin-manifest'
import dayjs from 'dayjs'
import { useDialog, useMessage } from 'naive-ui'
import { computed, onMounted, shallowRef, watch } from 'vue'

import { flowText as text } from '@/i18n/flows'
import AppIcon from '@/shared/components/AppIcon.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useConnectionStore } from '@/stores/connection'
import { usePluginsStore } from '@/stores/plugins'

const store = usePluginsStore()
const connection = useConnectionStore()
const message = useMessage()
const dialog = useDialog()
const editing = shallowRef(false)
const manifestText = shallowRef('')
const source = shallowRef('')
const configText = shallowRef('{}')
const enabled = shallowRef(true)
const scheduled = shallowRef(false)
const intervalHours = shallowRef<number | null>(1)
const flowId = shallowRef('')
const inputText = shallowRef('{}')
const editingFlow = shallowRef('')
const flowOptions = computed(
  () => store.selected?.document.flows.map(flow => ({ label: flow.id, value: flow.id })) ?? [],
)
watch(
  () => store.selectedId,
  () => {
    flowId.value = store.selected?.document.flows[0]?.id ?? ''
  },
)
const edit = (installation?: FlowInstallation) => {
  manifestText.value = JSON.stringify(
    installation?.manifest ?? {
      protocolVersion: 2,
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      server: { entry: 'flows.json' },
      resources: [],
    },
    null,
    2,
  )
  source.value = JSON.stringify(
    installation?.document ?? {
      version: 1,
      flows: [
        { id: 'main', steps: [{ id: 'result', op: 'return', value: { expr: { var: 'input' } } }] },
      ],
    },
    null,
    2,
  )
  configText.value = JSON.stringify(installation?.config ?? {}, null, 2)
  enabled.value = installation?.enabled ?? true
  scheduled.value = installation?.schedule?.enabled ?? false
  editingFlow.value =
    installation?.schedule?.flowId ?? installation?.document.flows[0]?.id ?? 'main'
  intervalHours.value = installation?.schedule?.intervalHours ?? 1
  editing.value = true
}
const save = async () => {
  try {
    const manifest = parsePluginManifest(JSON.parse(manifestText.value))
    const document = parseFlowDocument(JSON.parse(source.value))
    const config: unknown = JSON.parse(configText.value)
    if (typeof config !== 'object' || config === null || Array.isArray(config))
      throw new Error(text.configObject)
    const entry = manifest.server?.entry
    if (!entry) throw new Error(text.manifest)
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source.value)),
    )
    const manifestWithResource = {
      ...manifest,
      resources: [
        ...manifest.resources.filter(item => item.path !== entry),
        {
          path: entry,
          mimeType: 'application/json',
          integrity: `sha256-${btoa(String.fromCharCode(...digest))}`,
          imports: [],
        },
      ],
    }
    const result = await store.save(manifest.id, {
      manifest: manifestWithResource,
      source: source.value,
      config: Object.fromEntries(Object.entries(config)),
      enabled: enabled.value,
      schedule: {
        enabled: scheduled.value,
        flowId: editingFlow.value || document.flows[0]!.id,
        intervalHours: intervalHours.value ?? 1,
      },
    })
    if (result) {
      editing.value = false
      message.success(text.success)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  }
}
const run = async () => {
  try {
    const result = await store.run(store.selectedId, flowId.value, JSON.parse(inputText.value))
    if (result?.status === 'failed') message.error(result.error ?? text.failed)
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  }
}
const remove = (installation: FlowInstallation) =>
  dialog.warning({
    title: text.confirmRemove,
    content: installation.manifest.name,
    positiveText: text.remove,
    negativeText: text.cancel,
    onPositiveClick: () => store.remove(installation.manifest.id),
  })
onMounted(() => {
  if (connection.userToken) void store.load()
})
</script>

<template>
  <div class="admin-page max-w-[1600px]">
    <PageHeader :title="text.title">
      <template #actions>
        <NButton :loading="store.pending" :disabled="!connection.userToken" @click="store.load">
          <template #icon><AppIcon name="refresh" :size="17" /></template>{{ text.refresh }}
        </NButton>
        <NButton type="primary" :disabled="!connection.userToken" @click="edit()">{{
          text.install
        }}</NButton>
      </template>
    </PageHeader>
    <NAlert v-if="!connection.userToken" type="info" class="mb-4"
      ><RouterLink to="/settings">{{ text.token }}</RouterLink></NAlert
    >
    <NAlert v-if="store.error" type="error" class="mb-4">{{ store.error }}</NAlert>
    <div class="grid grid-cols-[260px_minmax(0,1fr)] gap-6 max-md:grid-cols-1">
      <aside class="border-border border-r pr-4 max-md:border-r-0 max-md:pr-0">
        <NEmpty v-if="!store.plugins.length" :description="text.empty" />
        <div
          v-for="plugin in store.plugins"
          :key="plugin.manifest.id"
          class="border-border border-b py-3"
        >
          <button class="text-left font-semibold" @click="store.select(plugin.manifest.id)">
            {{ plugin.manifest.name }}
          </button>
          <div class="text-foreground-secondary text-xs break-all">
            {{ plugin.manifest.id }} · {{ plugin.manifest.version }}
          </div>
          <div class="mt-2 flex items-center gap-2">
            <NSwitch
              :value="plugin.enabled"
              :disabled="store.pending"
              :aria-label="text.enabled"
              @update:value="value => store.configure(plugin, value)"
            />
            <span class="text-xs">{{ plugin.enabled ? text.enabled : text.disabled }}</span>
            <NButton size="tiny" @click="edit(plugin)">{{ text.edit }}</NButton>
            <NButton size="tiny" @click="remove(plugin)">{{ text.remove }}</NButton>
          </div>
        </div>
      </aside>
      <section v-if="store.selected" class="min-w-0">
        <h2 class="mb-3 text-lg font-semibold">{{ store.selected.manifest.name }}</h2>
        <div class="mb-3 flex gap-3">
          <NSelect v-model:value="flowId" :options="flowOptions" :placeholder="text.flow" />
          <NButton
            type="primary"
            :loading="store.pending"
            :disabled="!flowId || !store.selected.enabled"
            @click="run"
            >{{ text.run }}</NButton
          >
        </div>
        <NInput
          v-model:value="inputText"
          type="textarea"
          :aria-label="text.input"
          :autosize="{ minRows: 3, maxRows: 12 }"
        />
        <h3 class="my-4 font-semibold">{{ text.history }}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr>
                <th>{{ text.time }}</th>
                <th>{{ text.status }}</th>
                <th>{{ text.step }}</th>
                <th>{{ text.metrics }}</th>
                <th>{{ text.result }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in store.runs"
                :key="record.id"
                class="border-border border-b align-top"
              >
                <td class="py-2 whitespace-nowrap">
                  {{ dayjs(record.startedAt).format('YYYY-MM-DD HH:mm:ss') }}
                </td>
                <td class="p-2">{{ record.status }}</td>
                <td class="p-2">{{ record.stepId }}</td>
                <td class="p-2 whitespace-nowrap">
                  {{ record.metrics.steps }} / {{ record.metrics.http }} /
                  {{ record.metrics.durationMs.toFixed(1) }}
                </td>
                <td class="max-w-100 p-2 break-all">
                  {{ record.error ?? JSON.stringify(record.result) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <NEmpty v-else :description="text.select" />
    </div>
    <NModal
      v-model:show="editing"
      preset="card"
      :title="text.edit"
      class="w-225! max-w-[95vw]!"
      :mask-closable="false"
    >
      <NForm label-placement="top">
        <NFormItem :label="text.manifest"
          ><NInput
            v-model:value="manifestText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
        /></NFormItem>
        <NFormItem :label="text.source"
          ><NInput v-model:value="source" type="textarea" :autosize="{ minRows: 8, maxRows: 18 }"
        /></NFormItem>
        <NFormItem :label="text.configure"
          ><NInput
            v-model:value="configText"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 8 }"
        /></NFormItem>
        <NSpace align="center">
          <NCheckbox v-model:checked="enabled">{{ text.enabled }}</NCheckbox>
          <NCheckbox v-model:checked="scheduled">{{ text.schedule }}</NCheckbox>
          <NInput v-model:value="editingFlow" :placeholder="text.flow" />
          <NInputNumber
            v-model:value="intervalHours"
            :min="1"
            :max="168"
            :aria-label="text.interval"
          />
        </NSpace>
      </NForm>
      <template #footer
        ><NSpace justify="end"
          ><NButton @click="editing = false">{{ text.cancel }}</NButton
          ><NButton type="primary" :loading="store.pending" @click="save">{{
            text.save
          }}</NButton></NSpace
        ></template
      >
    </NModal>
  </div>
</template>