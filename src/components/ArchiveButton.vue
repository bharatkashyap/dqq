<script setup lang="ts">
import { CalendarDays } from "lucide-vue-next";
import { computed } from "vue";

import Button from "@/components/ui/Button.vue";

const props = defineProps<{
  active?: boolean;
  class?: string;
}>();

defineEmits<{
  click: [];
}>();

const buttonClass = computed(() =>
  [
    "pointer-events-auto rounded-full border-white/30 bg-zinc-950/70 text-zinc-100 shadow-[0_14px_32px_rgb(0_0_0_/_0.34),inset_0_1px_0_rgb(255_255_255_/_0.08)] backdrop-blur-md hover:border-[#d6a64f]/70 hover:bg-zinc-900/90",
    props.active ? "border-[#d6a64f]/70 bg-zinc-900/90 text-white" : "",
    props.class ?? "",
  ]
    .filter(Boolean)
    .join(" "),
);
</script>

<template>
  <Button
    variant="outline"
    size="icon"
    :class="buttonClass"
    :aria-pressed="active"
    aria-label="Open archive"
    title="Archive"
    @click="$emit('click')"
  >
    <CalendarDays class="size-5" />
    <span class="sr-only">Archive</span>
  </Button>
</template>
