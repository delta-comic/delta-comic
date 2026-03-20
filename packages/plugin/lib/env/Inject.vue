<script setup lang="ts" generic="T extends keyof GlobalInjections">
import { DcAwait } from '@delta-comic/ui'
import { computed } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { Global } from '@/global'

import type { GlobalInjections } from '.'
const $props = defineProps<{ key: T; args: ComponentProps<GlobalInjections[T]> }>()
const components = computed(() =>
  Array.from(Global.envExtends.values()).filter(v => v.key == $props.key)
)
</script>

<template>
  <template v-for="c in components">
    <DcAwait
      :promise="
        async () => {
          try {
            return await c.condition(args)
          } catch (error) {
            console.warn(error)
            return false
          }
        }
      "
      auto-load
      v-slot="{ result }"
    >
      <component :is="c.component" :="args" v-if="result" />
    </DcAwait>
  </template>
</template>