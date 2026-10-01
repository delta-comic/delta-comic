<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header
    class="page-header flex min-h-[86px] items-start justify-between gap-6 max-sm:mb-[22px] max-sm:min-h-0"
  >
    <div class="page-header__copy">
      <h1
        class="text-foreground m-0 text-[clamp(26px,2.4vw,34px)] leading-[1.2] font-[720] tracking-[-0.025em] max-sm:text-[27px]"
      >
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="text-foreground-secondary mt-2 mb-0 text-[15px] leading-[1.6] max-sm:text-sm"
      >
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions flex items-center gap-2.5">
      <slot name="actions" />
    </div>
  </header>
</template>