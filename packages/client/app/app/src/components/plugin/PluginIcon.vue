<script setup lang="ts">
import { resolvePluginIconUrl } from '@delta-comic/plugin'
import { computed, shallowRef, watch } from 'vue'

type PluginIconSize = 'large' | 'medium' | 'small'

const props = withDefaults(
  defineProps<{ icon?: string; name: string; pluginId?: string; size?: PluginIconSize }>(),
  { icon: undefined, pluginId: undefined, size: 'medium' },
)

const source = shallowRef<string>()
const failed = shallowRef(false)
const fallback = computed(() => Array.from(props.name.trim()).at(0)?.toLocaleUpperCase() ?? '?')
const sizeClass = computed(
  () =>
    ({
      large: 'size-16 rounded-2xl text-2xl',
      medium: 'size-10 rounded-xl text-base',
      small: 'size-8 rounded-lg text-sm',
    })[props.size],
)

watch(
  [() => props.icon, () => props.pluginId],
  async ([icon, pluginId], _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    source.value = undefined
    failed.value = false
    if (!icon) return

    try {
      const resolved = await resolvePluginIconUrl(pluginId, icon)
      if (active) source.value = resolved
    } catch {
      if (active) failed.value = true
    }
  },
  { immediate: true },
)

const handleError = () => {
  failed.value = true
  source.value = undefined
}
</script>

<template>
  <span
    :class="sizeClass"
    aria-hidden="true"
    class="plugin-icon grid shrink-0 place-items-center overflow-hidden bg-[color-mix(in_srgb,var(--nui-primary-color)_16%,transparent)] font-extrabold text-(--nui-primary-color)"
  >
    <img
      v-if="source && !failed"
      :src="source"
      alt=""
      decoding="async"
      loading="lazy"
      referrerpolicy="no-referrer"
      class="size-full object-cover"
      @error="handleError"
    />
    <span v-else>{{ fallback }}</span>
  </span>
</template>