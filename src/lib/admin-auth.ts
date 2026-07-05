import { computed, ref } from "vue";
import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
const STORAGE_NAMESPACE = CONVEX_URL.replace(/[^a-zA-Z0-9]/g, "");
const JWT_KEY = `__convexAuthJWT_${STORAGE_NAMESPACE}`;
const REFRESH_KEY = `__convexAuthRefreshToken_${STORAGE_NAMESPACE}`;
const SESSION_EXPIRY_KEY = `__convexAuthSessionExpiry_${STORAGE_NAMESPACE}`;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_RETRY_DELAYS_MS = [0, 500, 1500, 4000];
const REFRESH_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const REFRESH_WHEN_EXPIRING_WITHIN_MS = 2 * 60 * 60 * 1000;

export type AuthState = "loading" | "unauthenticated" | "authenticated";

function decodeJwtExpMs(token: string | null): number | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (!payload?.exp || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function isJwtUsableNow(token: string | null): boolean {
  if (!token) return false;
  const expMs = decodeJwtExpMs(token);
  if (!expMs) return true;
  return Date.now() < expMs;
}

function getStoredJwt(): string | null {
  const expiresAtRaw = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (expiresAtRaw) {
    const expiresAt = Number(expiresAtRaw);
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      clearJwtOnly();
      return null;
    }
  }

  return localStorage.getItem(JWT_KEY);
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function getStoredSessionExpiry(): number | null {
  const raw = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function storeTokens(
  jwt: string,
  refreshToken: string,
  expiresAt: number = Date.now() + SESSION_TTL_MS,
) {
  localStorage.setItem(JWT_KEY, jwt);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
}

function clearJwtOnly() {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

function clearTokens() {
  clearJwtOnly();
  localStorage.removeItem(REFRESH_KEY);
}

function clearRefreshTokenOnly() {
  localStorage.removeItem(REFRESH_KEY);
}

export function getStoredToken(): string | null {
  return getStoredJwt();
}

let client: ConvexClient | null = null;

function getConvexClient(): ConvexClient {
  if (!client) {
    if (!CONVEX_URL) {
      throw new Error("VITE_CONVEX_URL not set");
    }

    client = new ConvexClient(CONVEX_URL);
    client.setAuth(async () => getStoredJwt(), () => {});
  }

  return client;
}

const state = ref<AuthState>("loading");
const userId = ref<Id<"users"> | null>(null);
const email = ref<string | null>(null);
const authNotice = ref<string | null>(null);
const isLoading = computed(() => state.value === "loading");
const isAuthenticated = computed(() => state.value === "authenticated");

let refreshPromise: Promise<boolean> | null = null;
let refreshIntervalHandle: ReturnType<typeof setInterval> | null = null;

function ensureConvexAuthConfigured() {
  const currentClient = getConvexClient();
  currentClient.setAuth(async () => getStoredJwt(), () => {});
  return currentClient;
}

function clearAuthNotice() {
  authNotice.value = null;
}

function invalidateSession(notice?: string) {
  stopRefreshLoop();
  clearTokens();
  const currentClient = getConvexClient();
  currentClient.setAuth(async () => null, () => {});
  state.value = "unauthenticated";
  userId.value = null;
  email.value = null;
  if (notice) authNotice.value = notice;
}

async function validateCurrentJwt(currentClient: ConvexClient): Promise<boolean> {
  try {
    const user = await currentClient.query(api.users.currentUser, {});
    if (user?._id) {
      userId.value = user._id;
      email.value = user.email ?? null;
    }
    return !!user;
  } catch {
    return false;
  }
}

function startRefreshLoop() {
  if (refreshIntervalHandle) return;

  refreshIntervalHandle = setInterval(async () => {
    if (state.value !== "authenticated") return;

    const expiresAt = getStoredSessionExpiry();
    const refreshToken = getStoredRefreshToken();

    if (!refreshToken) {
      const jwt = getStoredJwt();
      if (!isJwtUsableNow(jwt)) {
        invalidateSession("Session expired. Please sign in again.");
      }
      return;
    }

    if (
      !expiresAt ||
      expiresAt - Date.now() <= REFRESH_WHEN_EXPIRING_WITHIN_MS
    ) {
      await refreshSession(false);
    }
  }, REFRESH_CHECK_INTERVAL_MS);
}

function stopRefreshLoop() {
  if (!refreshIntervalHandle) return;
  clearInterval(refreshIntervalHandle);
  refreshIntervalHandle = null;
}

async function refreshSession(forceAuthTransition: boolean): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    if (forceAuthTransition) {
      state.value = "unauthenticated";
    }
    return false;
  }

  const currentClient = ensureConvexAuthConfigured();

  refreshPromise = (async () => {
    for (const delay of REFRESH_RETRY_DELAYS_MS) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const result = await currentClient.action(api.auth.signIn, {
          refreshToken,
        });

        if (result?.tokens) {
          storeTokens(result.tokens.token, result.tokens.refreshToken);
          ensureConvexAuthConfigured();
          state.value = "authenticated";
          await validateCurrentJwt(currentClient);
          return true;
        }
      } catch {
        // retry
      }
    }

    const jwt = getStoredJwt();
    const jwtUsable = isJwtUsableNow(jwt);
    const online =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;

    if ((!jwtUsable || forceAuthTransition) && online) {
      invalidateSession("Session expired. Please sign in again.");
      return false;
    }

    if (online) {
      const jwtStillValid = await validateCurrentJwt(currentClient);
      if (!jwtStillValid) {
        invalidateSession("Session expired. Please sign in again.");
        return false;
      }

      clearRefreshTokenOnly();
      return false;
    }

    return false;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function bootstrap() {
  const storedRefresh = getStoredRefreshToken();
  const storedJwt = getStoredJwt();

  if (!storedJwt && !storedRefresh) {
    state.value = "unauthenticated";
    return;
  }

  ensureConvexAuthConfigured();

  if (storedJwt) {
    state.value = "authenticated";
    await validateCurrentJwt(getConvexClient());
    startRefreshLoop();
    void refreshSession(false);
    return;
  }

  const recovered = await refreshSession(true);
  if (recovered) {
    startRefreshLoop();
  }
}

async function signIn(
  provider: string,
  params: Record<string, unknown>,
  options?: { turnstileToken?: string },
) {
  const currentClient = getConvexClient();
  const result = await currentClient.action(api.auth.signIn, {
    provider,
    params,
    turnstileToken: options?.turnstileToken,
  });

  if (result?.tokens) {
    storeTokens(result.tokens.token, result.tokens.refreshToken);
    ensureConvexAuthConfigured();
    clearAuthNotice();
    email.value = typeof params.email === "string" ? params.email : null;
    state.value = "authenticated";
    await validateCurrentJwt(currentClient);
    startRefreshLoop();
    return { signingIn: true };
  }

  if (result?.started) {
    return { signingIn: false, started: true };
  }

  return { signingIn: false };
}

async function signOut() {
  try {
    await getConvexClient().action(api.auth.signOut, {});
  } catch {
    // Ignore sign-out transport failures and still clear local state.
  }

  invalidateSession();
}

export function useAdminAuth() {
  return {
    state,
    userId,
    email,
    authNotice,
    isLoading,
    isAuthenticated,
    bootstrap,
    signIn,
    signOut,
    clearAuthNotice,
    invalidateSession,
  };
}
