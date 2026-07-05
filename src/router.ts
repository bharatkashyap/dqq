import { createRouter, createWebHistory } from "vue-router";
import { getStoredToken } from "@/lib/admin-auth";
import AppView from "./App.vue";
import AdminLogin from "./admin/AdminLogin.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: AppView,
  },
  {
    path: "/:date(\\d{4}-\\d{2}-\\d{2})",
    name: "daily-question",
    component: AppView,
  },
  {
    path: "/admin/login",
    name: "admin-login",
    component: AdminLogin,
  },
  {
    path: "/admin",
    name: "admin",
    component: () => import("./admin/AdminView.vue"),
    meta: { requiresAuth: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const isAuthenticated = Boolean(getStoredToken());

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: "admin-login", query: { redirect: to.fullPath } };
  }

  if (to.name === "admin-login" && isAuthenticated) {
    return { name: "admin" };
  }
});
