<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__copy">
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  @apply [display:flex];
  @apply [gap:24px];
  @apply [align-items:flex-start];
  @apply [justify-content:space-between];
  @apply [min-height:86px];
}

.page-header__copy h1 {
  @apply [margin:0];
  @apply [color:var(--dc-text)];
  @apply [font-size:clamp(26px,_2.4vw,_34px)];
  @apply [font-weight:720];
  @apply [line-height:1.2];
  @apply [letter-spacing:-0.025em];
}

.page-header__copy p {
  @apply [margin:8px_0_0];
  @apply [color:var(--dc-text-secondary)];
  @apply [font-size:15px];
  @apply [line-height:1.6];
}

.page-header__actions {
  @apply [display:flex];
  @apply [gap:10px];
  @apply [align-items:center];
}

@media (max-width: 640px) {
  .page-header {
    @apply [min-height:0];
    @apply [margin-bottom:22px];
  }

  .page-header__copy h1 {
    @apply [font-size:27px];
  }

  .page-header__copy p {
    @apply [font-size:14px];
  }
}
</style>