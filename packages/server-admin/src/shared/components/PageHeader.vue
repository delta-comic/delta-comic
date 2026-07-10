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
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  min-height: 86px;
}

.page-header__copy h1 {
  margin: 0;
  color: #111722;
  font-size: clamp(26px, 2.4vw, 34px);
  font-weight: 720;
  line-height: 1.2;
  letter-spacing: -0.025em;
}

.page-header__copy p {
  margin: 8px 0 0;
  color: var(--dc-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.page-header__actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

@media (max-width: 640px) {
  .page-header {
    min-height: 0;
    margin-bottom: 22px;
  }

  .page-header__copy h1 {
    font-size: 27px;
  }

  .page-header__copy p {
    font-size: 14px;
  }
}
</style>