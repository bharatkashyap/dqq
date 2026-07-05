<template>
  <div
    v-if="accessState === 'loading'"
    class="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400"
  >
    Checking admin access...
  </div>

  <div
    v-else-if="accessState === 'redirecting'"
    class="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400"
  >
    Redirecting...
  </div>

  <AdminPanel v-else />
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useConvexQuery } from "convex-vue";
import { api } from "../../convex/_generated/api";
import AdminPanel from "./AdminPanel.vue";
import { useAdminAuth } from "@/lib/admin-auth";

const router = useRouter();
const auth = useAdminAuth();
const { data: viewerData, isPending: viewerPending } = useConvexQuery(
  api.admin.viewer,
  {},
);

const viewer = viewerData;

const accessState = computed(() => {
  if (auth.isLoading.value || viewerPending.value) {
    return "loading";
  }

  if (!auth.isAuthenticated.value || !viewer.value?.isAdmin) {
    return "redirecting";
  }

  return "ready";
});

watch(
  accessState,
  (state) => {
    if (state === "loading" || state === "ready") {
      return;
    }

    if (!auth.isAuthenticated.value) {
      router.replace("/admin/login");
      return;
    }

    if (!viewer.value?.isAdmin) {
      router.replace("/");
    }
  },
  { immediate: true },
);
</script>
