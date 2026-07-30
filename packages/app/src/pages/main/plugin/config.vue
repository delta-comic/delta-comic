<script setup lang="ts">
import { useConfig } from '@delta-comic/plugin'
import { NDynamicInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const cfg = useConfig().$loadApp()
const { t, te } = useI18n()

const translateTitle = (title: string) => (te(title) ? t(title) : title)
</script>

<template>
  <NScrollbar class="size-full">
    <div class="mb-2 ml-4 text-lg font-semibold">
      {{ translateTitle(cfg.form.receivePerReleaseUpdate.info) }}
    </div>
    <DcFormSwitch
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
        <div class="flex w-[calc(100%-var(--spacing)*25)] items-center">
          <NInput
            v-model:value="value.key"
            class="w-2/3!"
            type="text"
            :placeholder="t('plugin.config.pluginId')"
          />
          <NInput
            v-model:value="value.value"
            type="text"
            class="my-2"
            :placeholder="t('plugin.config.downloadCommand')"
          />
        </div>
      </template>
    </NDynamicInput>
  </NScrollbar>
</template>