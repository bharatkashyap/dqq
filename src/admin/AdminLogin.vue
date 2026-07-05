<template>
  <div
    class="admin-auth-shell min-h-screen flex items-center justify-center px-4"
  >
    <div class="w-full max-w-md">
      <div
        class="rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl shadow-black/30 backdrop-blur"
      >
        <div class="mb-8">
          <p
            class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70"
          >
            Admin access
          </p>
          <h1 class="mt-3 text-3xl font-black tracking-tight text-white">
            Quiz Admin
          </h1>
          <p class="mt-2 text-sm text-zinc-400">
            Securely sign in with email and a one-time code.
          </p>
        </div>

        <div v-if="step === 'email'" class="space-y-5">
          <div>
            <label class="mb-2 block text-sm font-medium text-zinc-200"
              >Email</label
            >
            <input
              ref="emailInputRef"
              v-model="email"
              type="email"
              placeholder="admin@example.com"
              class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
              :disabled="loading"
              @blur="
                emailSubmitAttempted
                  ? (emailError = validateEmail())
                  : (emailError = '')
              "
              @keypress="handleKeypress"
            />
            <p v-if="emailError" class="mt-2 text-xs text-red-300">
              {{ emailError }}
            </p>
          </div>

          <div>
            <div ref="turnstileHostRef" class="min-h-[72px]" />
            <p v-if="turnstileError" class="mt-2 text-xs text-red-300">
              {{ turnstileError }}
            </p>
          </div>

          <button
            class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canSubmitEmail"
            @click="handleEmailSubmit"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            {{ loading ? "Sending code..." : "Continue" }}
          </button>
        </div>

        <div v-else class="space-y-5">
          <p class="text-sm text-zinc-400">
            We sent a code to
            <span class="font-medium text-white">{{ email }}</span>
          </p>

          <div>
            <label class="mb-2 block text-sm font-medium text-zinc-200">
              Verification code
            </label>
            <input
              v-model="otp"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="123456"
              class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.35em] text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
              :disabled="loading"
              @keypress="handleKeypress"
            />
          </div>

          <button
            class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="loading"
            @click="handleOTPSubmit"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            {{ loading ? "Verifying..." : "Sign in" }}
          </button>

          <button
            class="w-full text-sm text-zinc-400 transition hover:text-white"
            @click="resetToEmail"
          >
            Back to email
          </button>
        </div>

        <p
          v-if="error"
          class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Loader2 } from "lucide-vue-next";
import { useAdminAuth } from "@/lib/admin-auth";

type TurnstileApi = {
  render: (
    container: HTMLElement | string,
    options: Record<string, unknown>,
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const router = useRouter();
const route = useRoute();
const auth = useAdminAuth();

const step = ref<"email" | "otp">("email");
const email = ref("");
const otp = ref("");
const loading = ref(false);
const error = ref("");
const emailError = ref("");
const emailSubmitAttempted = ref(false);
const emailInputRef = ref<HTMLInputElement | null>(null);
const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
const turnstileHostRef = ref<HTMLDivElement | null>(null);
const turnstileWidgetId = ref<string | null>(null);
const turnstileToken = ref("");
const turnstileError = ref("");

let turnstileScriptPromise: Promise<void> | null = null;

watch(
  () => auth.isAuthenticated.value,
  (authenticated) => {
    if (authenticated) {
      const redirect =
        typeof route.query.redirect === "string"
          ? route.query.redirect
          : "/admin";
      router.replace(redirect);
    }
  },
  { immediate: true },
);

function loadTurnstileScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-turnstile-script='1']",
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load security verification")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "1";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Could not load security verification"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

function resetTurnstileWidget() {
  turnstileToken.value = "";
  if (window.turnstile && turnstileWidgetId.value) {
    window.turnstile.reset(turnstileWidgetId.value);
  }
}

async function mountTurnstileWidget() {
  if (!turnstileSiteKey) {
    turnstileError.value =
      "Security verification is unavailable. Please try again later.";
    return;
  }

  await loadTurnstileScript();
  if (!window.turnstile || !turnstileHostRef.value) {
    turnstileError.value =
      "Security verification is unavailable. Please try again later.";
    return;
  }

  turnstileWidgetId.value = window.turnstile.render(turnstileHostRef.value, {
    sitekey: turnstileSiteKey,
    callback: (token: string) => {
      turnstileToken.value = token;
      turnstileError.value = "";
    },
    "expired-callback": () => {
      turnstileToken.value = "";
      turnstileError.value = "Security check expired. Please verify again.";
    },
    "error-callback": () => {
      turnstileToken.value = "";
      turnstileError.value = "Security check failed. Please verify again.";
    },
  });
}

onMounted(() => {
  void mountTurnstileWidget();
});

onUnmounted(() => {
  if (window.turnstile && turnstileWidgetId.value) {
    window.turnstile.remove(turnstileWidgetId.value);
  }
});

const canSubmitEmail = computed(
  () =>
    !loading.value &&
    !emailError.value &&
    !!email.value.trim() &&
    !!turnstileToken.value,
);

const validateEmail = () => {
  const normalized = email.value.trim();
  if (!normalized) return "Email is required";

  const el = emailInputRef.value;
  if (el) {
    el.value = normalized;
    if (el.validity.typeMismatch || el.validity.patternMismatch) {
      console.log("el.validity", el.validity);
      return "Please enter a valid email address";
    }
  }

  return "";
};

async function handleEmailSubmit() {
  emailSubmitAttempted.value = true;
  email.value = email.value.trim();
  emailError.value = validateEmail();
  if (emailError.value) return;

  if (!turnstileToken.value) {
    turnstileError.value = "Please complete the security check to continue.";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    await auth.signIn(
      "zeptomail-otp",
      { email: email.value },
      { turnstileToken: turnstileToken.value },
    );
    step.value = "otp";
  } catch (err: any) {
    const rawMessage = err?.message || "";
    if (
      rawMessage.includes("Failed to send OTP") ||
      rawMessage.includes("fetch")
    ) {
      error.value = "Could not send verification code. Please try again.";
    } else if (rawMessage.includes("Security verification")) {
      error.value = "Please complete the security check and try again.";
      resetTurnstileWidget();
    } else if (rawMessage.includes("rate limit")) {
      error.value = "Too many attempts. Please wait a few minutes.";
    } else {
      error.value = "Something went wrong. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}

async function handleOTPSubmit() {
  if (!otp.value || otp.value.length !== 6) {
    error.value = "Please enter the 6-digit code";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    await auth.signIn("zeptomail-otp", {
      email: email.value,
      code: otp.value,
    });
    await router.replace("/admin");
  } catch (err: any) {
    const rawMessage = err?.message || "";
    if (rawMessage.includes("verify code") || rawMessage.includes("Invalid")) {
      error.value = "Invalid code. Please check and try again.";
    } else if (rawMessage.includes("expired")) {
      error.value = "Code expired. Please request a new one.";
    } else {
      error.value = "Could not verify code. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}

function handleKeypress(e: KeyboardEvent) {
  if (e.key !== "Enter") return;
  if (step.value === "email") {
    void handleEmailSubmit();
  } else {
    void handleOTPSubmit();
  }
}

function resetToEmail() {
  step.value = "email";
  otp.value = "";
  error.value = "";
  resetTurnstileWidget();
}

watch(email, () => {
  if (!emailSubmitAttempted.value) return;
  emailError.value = validateEmail();
});
</script>
