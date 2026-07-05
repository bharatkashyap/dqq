import { createApp } from "vue";
import { convexVue } from "convex-vue";
import "./style.css";
import { router } from "./router";
import AppRoot from "./AppRoot.vue";
import { useAdminAuth } from "@/lib/admin-auth";

const app = createApp(AppRoot);

app.use(router);

app.use(convexVue, {
  url: import.meta.env.VITE_CONVEX_URL,
});

void useAdminAuth().bootstrap();

app.mount("#app");
