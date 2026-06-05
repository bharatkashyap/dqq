<script setup lang="ts">
import { computed } from "vue"

import { cn } from "@/lib/utils"

const props = withDefaults(
  defineProps<{
    variant?: "default" | "secondary" | "ghost" | "outline"
    size?: "sm" | "default" | "icon"
    class?: string
    type?: "button" | "submit" | "reset"
  }>(),
  {
    variant: "default",
    size: "default",
    type: "button",
  },
)

const buttonClass = computed(() =>
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70 disabled:pointer-events-none disabled:opacity-45",
    props.variant === "default" &&
      "bg-lime-300 text-zinc-950 shadow-[0_0_24px_rgba(190,242,100,0.22)] hover:bg-lime-200",
    props.variant === "secondary" &&
      "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
    props.variant === "ghost" &&
      "text-zinc-300 hover:bg-zinc-900 hover:text-white",
    props.variant === "outline" &&
      "border border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900",
    props.size === "default" && "h-11 px-4 py-2",
    props.size === "sm" && "h-9 px-3",
    props.size === "icon" && "size-10",
    props.class,
  ),
)
</script>

<template>
  <button :type="type" :class="buttonClass">
    <slot />
  </button>
</template>
