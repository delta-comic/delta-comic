<script setup lang='ts'>
import { Comp, Store } from 'delta-comic-core'
import {  isEmpty } from 'es-toolkit/compat'

const config = Store.useConfig()
</script>

<template>
  <VanNavBar title="设置" left-arrow @click-left="$router.back()" class="pt-safe" />
  <NScrollbar class="w-full h-[calc(100%-46px)]">
    <VanCellGroup v-for="[plugin, { form, value: store }] of config.form.entries()" :title="plugin.description">
      <template v-for="[name, config] of Object.entries(form)">
        <VanCell center v-if="config.type == 'switch'" :title="config.info">
          <template #right-icon>
            <VanSwitch v-model="store.value[name]" />
          </template>
        </VanCell>
        <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'string'">
          <VanCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </VanCell>
          <template #empty>
            <NInput clearable :allowInput="v => config.patten ? config.patten.test(v) || isEmpty(v) : true"
              :placeholder="config.placeholder" v-model:value="store.value[name]" class="!w-[80vw]" />
          </template>
        </NPopselect>
        <NPopselect :options="[]" trigger="click" size="huge" v-else-if="config.type == 'number'">
          <VanCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </VanCell>
          <template #empty>
            <NInputNumber :precision="config.float ? undefined : 0" clearable :min="config.range?.[0]"
              :max="config.range?.[1]" :placeholder="config.placeholder" v-model:value="store.value[name]"
              class="!w-[80vw]" />
          </template>
        </NPopselect>
        <NPopselect :options="config.selects" trigger="click" placement="bottom-end" size="huge"
          v-else-if="config.type == 'radio'" v-model:value="store.value[name]">
          <VanCell center :title="config.info" clickable>
            {{config.selects.find(v => v.value == store.value[name])?.label}}
          </VanCell>
        </NPopselect>
        <NPopselect :options="config.selects" trigger="click" placement="bottom-end" size="huge" multiple
          v-else-if="config.type == 'checkbox'" v-model:value="store.value[name]">
          <VanCell center :title="config.info" clickable>
            {{ store.value[name] }}
          </VanCell>
        </NPopselect>
        <Comp.Var v-else-if="config.type == 'date'" :value="{ show: false }" v-slot="{ value }">
          <VanCell center :title="config.info" clickable @click="value.show = true">
            {{ store.value[name] }}
            <Comp.Popup v-model:show="value.show" overlay round closeable position="center" class="flex justify-center">
              <NDatePicker input-readonly v-model:value="store.value[name]" />
            </Comp.Popup>
          </VanCell>
        </Comp.Var>
      </template>
    </VanCellGroup>
  </NScrollbar>
</template>