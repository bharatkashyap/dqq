<template></template>

<script setup lang="ts">
import { watch } from "vue";
import { useConvexClient } from "convex-vue";
import { getStoredToken, useAdminAuth } from "@/lib/admin-auth";

const convex = useConvexClient();
const auth = useAdminAuth();

watch(
  () => auth.state.value,
  () => {
    convex.setAuth(async () => getStoredToken(), () => {});
  },
  { immediate: true },
);
</script>
