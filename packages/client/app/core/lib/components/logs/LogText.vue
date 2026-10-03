<script setup vapor lang="ts">
defineProps<{ content: string }>()
</script>

<template>
  <pre
    class="m-0 min-w-max cursor-text font-mono text-xs leading-5 wrap-break-word whitespace-pre-wrap text-dc-text select-text"
    >{{ content }}</pre>
</template>