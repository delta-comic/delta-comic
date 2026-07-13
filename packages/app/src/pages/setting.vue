<script setup lang="ts">
import type { FormSingleConfigure } from '@delta-comic/model'
import { useConfig } from '@delta-comic/plugin'
import { DcCell, DcCellGroup } from '@delta-comic/ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const $router = useRouter()
const config = useConfig()
const { t, te } = useI18n()

const translateText = (value: string | undefined) => (value && te(value) ? t(value) : (value ?? ''))

const localizeFormConfig = <T extends FormSingleConfigure>(config: T): T => {
  const localized: FormSingleConfigure = {
    ...config,
    info: translateText(config.info),
    placeholder: translateText(config.placeholder) || undefined,
  }
  if (localized.type === 'radio' || localized.type === 'checkbox') {
    localized.selects = localized.selects.map(option => ({
      ...option,
      label: translateText(option.label),
    }))
  }
  return localized as T
}
</script>

<template>
  <div
    class="box-content flex h-(--dc-page-header-height) items-center bg-(--dc-surface) px-4 pt-safe"
  >
    <NPageHeader class="w-full" :title="t('settings.title')" @back="$router.back()" />
  </div>
  <NScrollbar class="h-[calc(100%-var(--dc-page-header-height)-var(--safe-area-inset-top))] w-full">
    <div class="mx-auto w-full max-w-5xl py-2">
      <DcCellGroup
        v-for="[
          formKey,
          {
            form,
            data: { value: store },
            name: title,
          },
        ] of config.form.entries()"
        :key="formKey"
        :title="translateText(title)"
      >
        <template v-for="[name, config] of Object.entries(form)" :key="name">
          <DcCell center v-if="config.type == 'switch'" :title="translateText(config.info)">
            <template #right-icon>
              <DcFormSwitch :config="localizeFormConfig(config)" v-model="store.value[name]" />
            </template>
          </DcCell>
          <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'string'">
            <DcCell center :title="translateText(config.info)" clickable>
              {{ store.value[name] }}
            </DcCell>
            <template #empty>
              <DcFormString
                :config="localizeFormConfig(config)"
                v-model="store.value[name]"
                class="max-w-[80vw]!"
              />
            </template>
          </NPopselect>
          <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'number'">
            <DcCell center :title="translateText(config.info)" clickable>
              {{ store.value[name] }}
            </DcCell>
            <template #empty>
              <DcFormNumber
                :config="localizeFormConfig(config)"
                v-model="store.value[name]"
                class="max-w-[80vw]!"
              />
            </template>
          </NPopselect>
          <NPopselect
            :options="localizeFormConfig(config).selects"
            trigger="click"
            placement="bottom-end"
            size="huge"
            v-else-if="config.type == 'radio'"
            v-model:value="store.value[name]"
          >
            <DcCell center :title="translateText(config.info)" clickable>
              {{
                localizeFormConfig(config).selects.find(v => v.value == store.value[name])?.label
              }}
            </DcCell>
          </NPopselect>
          <NPopselect
            :options="localizeFormConfig(config).selects"
            trigger="click"
            placement="bottom-end"
            size="huge"
            multiple
            v-else-if="config.type == 'checkbox'"
            v-model:value="store.value[name]"
          >
            <DcCell center :title="translateText(config.info)" clickable>
              {{ store.value[name] }}
            </DcCell>
          </NPopselect>
          <DcVar v-else-if="config.type == 'date'" :value="{ show: false }" v-slot="{ value }">
            <DcCell center :title="translateText(config.info)" clickable @click="value.show = true">
              {{ store.value[name] }}
              <NModal v-model:show="value.show" preset="dialog" :title="store.value[name]">
                <DcFormDate
                  :config="localizeFormConfig(config)"
                  v-model="store.value[name]"
                  class="max-w-[80vw]!"
                />
              </NModal>
            </DcCell>
          </DcVar>
          <DcVar v-else-if="config.type == 'dateRange'" :value="{ show: false }" v-slot="{ value }">
            <DcCell center :title="translateText(config.info)" clickable @click="value.show = true">
              {{ store.value[name] }}
              <NModal v-model:show="value.show" preset="dialog" :title="store.value[name]">
                <DcFormDateRange
                  :config="localizeFormConfig(config)"
                  v-model="store.value[name]"
                  class="max-w-[80vw]!"
                />
              </NModal>
            </DcCell>
          </DcVar>
          <DcVar v-else-if="config.type == 'pairs'" :value="{ show: false }" v-slot="{ value }">
            <DcCell center :title="translateText(config.info)" clickable @click="value.show = true">
              {{ store.value[name] }}
              <NModal v-model:show="value.show" preset="dialog" :title="store.value[name]">
                <DcFormPairs
                  :config="localizeFormConfig(config)"
                  v-model="store.value[name]"
                  class="max-w-[80vw]!"
                />
              </NModal>
            </DcCell>
          </DcVar>
        </template>
      </DcCellGroup>
    </div>
  </NScrollbar>
</template>