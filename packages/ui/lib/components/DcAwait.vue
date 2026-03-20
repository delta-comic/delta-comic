<script setup lang="ts" generic="T extends PromiseLike<unknown>">
import { shallowRef, watch } from 'vue'

defineSlots<{ default(arg: { result: Awaited<T> | undefined; load: typeof load }): any }>()
const $props = defineProps<{ promise: () => T; autoLoad?: boolean }>()
const result = shallowRef<Awaited<T>>()
const load = async () => (result.value = await $props.promise())
watch(
  () => [$props.promise, $props.autoLoad] as const,
  _promise => {
    if ($props.autoLoad) load()
  },
  { immediate: true }
)
</script>

<template>
  <slot :load :result></slot>
</template>