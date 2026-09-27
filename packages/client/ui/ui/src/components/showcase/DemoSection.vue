<script setup lang="ts">
defineProps<{ title: string; description: string; sectionId?: string }>()

defineSlots<{ default(): unknown; actions(): unknown; note(): unknown }>()
</script>

<template>
  <section
    :id="sectionId"
    class="overflow-hidden rounded-xl border border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] shadow-[0_8px_30px_rgb(0_0_0/0.03)]"
  >
    <header
      class="flex flex-col gap-3 border-b border-[var(--nui-divider-color)] px-5 py-4 sm:flex-row sm:items-start"
    >
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-semibold text-[var(--nui-text-color-1)]">{{ title }}</h2>
        <p class="mt-1 text-sm leading-6 text-[var(--nui-text-color-3)]">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </header>

    <div class="bg-[var(--nui-body-color)] p-4 sm:p-6">
      <slot />
    </div>

    <footer
      v-if="$slots.note"
      class="border-t border-[var(--nui-divider-color)] bg-[var(--nui-card-color)] px-5 py-3 text-xs leading-5 text-[var(--nui-text-color-3)]"
    >
      <slot name="note" />
    </footer>
  </section>
</template>