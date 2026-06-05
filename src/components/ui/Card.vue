<script setup lang="ts">
defineProps<{
  class?: unknown
}>()
</script>

<template>
  <section :class="['rounded-lg border border-zinc-800 bg-zinc-950/72 shadow-2xl shadow-black/20', $props.class]">
    <slot />
  </section>
</template>
