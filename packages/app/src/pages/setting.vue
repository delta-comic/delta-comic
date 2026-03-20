<script setup lang="ts">
import { useConfig } from '@delta-comic/plugin'

const config = useConfig()
</script>

<template>
  <VanNavBar title="设置" left-arrow @click-left="$router.back()" class="pt-safe" />
  <NScrollbar class="h-[calc(100%-46px)] w-full">
    <VanCellGroup
      v-for="[plugin, { form, value: store }] of config.form.entries()"
      :title="plugin.description?.split('|')[1] ?? plugin.description"
    >
      <template v-for="[name, config] of Object.entries(form)">
        <VanCell center v-if="config.type == 'switch'" :title="config.info">
          <template #right-icon>
            <DcFormSwitch :config v-model="store.value[name]" />
          </template>
        </VanCell>
        <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'string'">
          <VanCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </VanCell>
          <template #empty>
            <DcFormString :config v-model="store.value[name]" class="max-w-[80vw]!" />
          </template>
        </NPopselect>
        <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'number'">
          <VanCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </VanCell>
          <template #empty>
            <DcFormNumber :config v-model="store.value[name]" class="max-w-[80vw]!" />
          </template>
        </NPopselect>
        <NPopselect
          :options="config.selects"
          trigger="click"
          placement="bottom-end"
          size="huge"
          v-else-if="config.type == 'radio'"
          v-model:value="store.value[name]"
        >
          <VanCell center :title="config.info" clickable>
            {{ config.selects.find(v => v.value == store.value[name])?.label }}
          </VanCell>
        </NPopselect>
        <NPopselect
          :options="config.selects"
          trigger="click"
          placement="bottom-end"
          size="huge"
          multiple
          v-else-if="config.type == 'checkbox'"
          v-model:value="store.value[name]"
        >
          <VanCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </VanCell>
        </NPopselect>
        <DcVar v-else-if="config.type == 'date'" :value="{ show: false }" v-slot="{ value }">
          <VanCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <DcPopup
              v-model:show="value.show"
              overlay
              round
              closeable
              position="center"
              class="flex justify-center"
            >
              <DcFormDate :config v-model="store.value[name]" class="max-w-[80vw]!" />
            </DcPopup>
          </VanCell>
        </DcVar>
        <DcVar v-else-if="config.type == 'dateRange'" :value="{ show: false }" v-slot="{ value }">
          <VanCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <DcPopup
              v-model:show="value.show"
              overlay
              round
              closeable
              position="center"
              class="flex justify-center"
            >
              <DcFormDateRange :config v-model="store.value[name]" class="max-w-[80vw]!" />
            </DcPopup>
          </VanCell>
        </DcVar>
        <DcVar v-else-if="config.type == 'pairs'" :value="{ show: false }" v-slot="{ value }">
          <VanCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <DcPopup
              v-model:show="value.show"
              overlay
              round
              closeable
              position="center"
              class="flex justify-center"
            >
              <DcFormPairs :config v-model="store.value[name]" class="max-w-[80vw]!" />
            </DcPopup>
          </VanCell>
        </DcVar>
      </template>
    </VanCellGroup>
  </NScrollbar>
</template>