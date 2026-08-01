<script setup lang="ts">
import { Core, useConfig } from '@delta-comic/plugin'
import { NDynamicInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const cfg = useConfig().load(Core.cfg)
const { t, te } = useI18n()

const translateTitle = (title: string) => (te(title) ? t(title) : title)
</script>

<template>
  <NScrollbar class="size-full">
    <div class="mb-2 ml-4 text-lg font-semibold">
      {{ translateTitle(cfg.form.receivePerReleaseUpdate.info) }}
    </div>
    <DcFormSwitch
      class="ml-6"
      :config="cfg.form.receivePerReleaseUpdate"
      v-model="cfg.data.value.receivePerReleaseUpdate"
    />
    <div class="mb-2 ml-4 text-lg font-semibold">
      {{ translateTitle(cfg.form.installOverride.info) }}
    </div>
    <NDynamicInput
      v-model:value="cfg.data.value.installOverride"
      :on-create="() => ({ key: '', value: '' })"
    >
      <template #default="{ value }">
        <div class="flex w-[calc(100%-var(--spacing)*25)] flex-col items-center gap-2 pl-6">
          <NInput
            v-model:value="value.key"
            type="text"
            :placeholder="t('plugin.config.pluginId')"
          />
          <NInput
            v-model:value="value.value"
            type="text"
            :placeholder="t('plugin.config.downloadCommand')"
          />
          <NDivider class="my-2!" />
        </div>
      </template>
    </NDynamicInput>
  </NScrollbar>
</template>