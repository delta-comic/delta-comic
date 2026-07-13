<script setup lang="ts">
import { uni } from '@delta-comic/model'
import { NSelect } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const show = defineModel<boolean>('show', { required: true })
const $emit = defineEmits<{ change: [] }>()
const { t } = useI18n()
</script>

<template>
  <NDrawer v-model:show="show" placement="bottom">
    <div class="min-h-60 w-full px-2">
      <div class="mb-2 pt-3 pl-5 text-2xl">{{ t('source.changeTitle') }}</div>
      <div
        v-for="[plugin, value] in Object.entries(
          Object.groupBy(
            Array.from(uni.image.Image.fork.entries()).map(([key, { urls: forks }]) => {
              const [plugin, namespace] = uni.image.Image.fork.key.toJSON(key)
              return {
                plugin,
                namespace,
                forks,
                active: uni.image.Image.precedenceFork.get(key)!,
                key,
              }
            }),
            v => v.plugin,
          ),
        )"
      >
        <div class="text-lg text-(--p-color)">{{ plugin }}</div>
        <div v-for="v in value!">
          <div class="-mt-1 pl-1 text-[14px]">{{ v.namespace }}</div>
          <NSelect
            :options="v.forks.map(v => ({ value: v, label: v }))"
            :value="v.active"
            @update:value="
              url => {
                uni.image.Image.precedenceFork.set(v.key, url)
                $emit('change')
              }
            "
          />
        </div>
      </div>
    </div>
  </NDrawer>
</template>