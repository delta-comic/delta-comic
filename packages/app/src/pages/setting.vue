<script setup lang="ts">
import { useConfig } from '@delta-comic/plugin'
import { DcCell, DcCellGroup } from '@delta-comic/ui'

const config = useConfig()
</script>

<template>
  <VanNavBar title="设置" left-arrow @click-left="$router.back()" class="pt-safe" />
  <NScrollbar class="h-[calc(100%-46px)] w-full">
    <DcCellGroup
      v-for="[
        _,
        {
          form,
          value: { value: store },
          name: title,
        },
      ] of config.form.entries()"
      :title
    >
      <template v-for="[name, config] of Object.entries(form)">
        <DcCell center v-if="config.type == 'switch'" :title="config.info">
          <template #right-icon>
            <DcFormSwitch :config v-model="store.value[name]" />
          </template>
        </DcCell>
        <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'string'">
          <DcCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </DcCell>
          <template #empty>
            <DcFormString :config v-model="store.value[name]" class="max-w-[80vw]!" />
          </template>
        </NPopselect>
        <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'number'">
          <DcCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </DcCell>
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
          <DcCell center :title="config.info" clickable>
            {{ config.selects.find(v => v.value == store.value[name])?.label }}
          </DcCell>
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
          <DcCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </DcCell>
        </NPopselect>
        <DcVar v-else-if="config.type == 'date'" :value="{ show: false }" v-slot="{ value }">
          <DcCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <NModal v-model:show="value.show" preset="dialog" :title="store.value[name]">
              <DcFormDate :config v-model="store.value[name]" class="max-w-[80vw]!" />
            </NModal>
          </DcCell>
        </DcVar>
        <DcVar v-else-if="config.type == 'dateRange'" :value="{ show: false }" v-slot="{ value }">
          <DcCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <NModal v-model:show="value.show" preset="dialog" :title="store.value[name]">
              <DcFormDateRange :config v-model="store.value[name]" class="max-w-[80vw]!" />
            </NModal>
          </DcCell>
        </DcVar>
        <DcVar v-else-if="config.type == 'pairs'" :value="{ show: false }" v-slot="{ value }">
          <DcCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <NModal v-model:show="value.show" preset="dialog" :title="store.value[name]">
              <DcFormPairs :config v-model="store.value[name]" class="max-w-[80vw]!" />
            </NModal>
          </DcCell>
        </DcVar>
      </template>
    </DcCellGroup>
  </NScrollbar>
</template>