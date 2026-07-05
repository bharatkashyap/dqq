import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { action } from "./_generated/server";
import { v } from "convex/values";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SignInArgs = {
  provider?: string;
  params?: Record<string, unknown>;
  verifier?: string;
  refreshToken?: string;
  calledBy?: string;
  turnstileToken?: string;
};

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

type RuntimeEnv = {
  process?: { env?: Record<string, string | undefined> };
  ENV?: Record<string, string | undefined>;
};

function needsTurnstile(args: SignInArgs) {
  return (
    args.provider === "zeptomail-otp" &&
    args.refreshToken === undefined &&
    (args.params as { code?: string } | undefined)?.code === undefined
  );
}

async function verifyTurnstile(token: string) {
  const runtimeEnv = globalThis as unknown as RuntimeEnv;
  const secret =
    runtimeEnv.process?.env?.CLOUDFLARE_TURNSTILE_SECRET_KEY ??
    runtimeEnv.ENV?.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[auth] Missing CLOUDFLARE_TURNSTILE_SECRET_KEY");
    throw new Error("Security verification is unavailable");
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Security verification failed");
  }

  const verification = (await response.json()) as TurnstileVerifyResponse;
  if (!verification.success) {
    console.warn("[auth] Turnstile rejected challenge", {
      errors: verification["error-codes"] || [],
    });
    throw new Error("Security verification failed");
  }
}

function generateSecureOtpToken() {
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return String(randomValue % 1_000_000).padStart(6, "0");
}

const ZeptomailOTP = Email({
  id: "zeptomail-otp",
  generateVerificationToken: () => generateSecureOtpToken(),
  async sendVerificationRequest({ identifier: email, token }) {
    const runtimeEnv = globalThis as unknown as RuntimeEnv;
    const env = runtimeEnv.process?.env || runtimeEnv.ENV || {};
    const baseUrl = env.ZEPTOMAIL_URL;
    const templateId = env.ZEPTOMAIL_TEMPLATE_ID;
    const apiToken = env.ZEPTOMAIL_API_TOKEN;

    const url = new URL("/v1.1/email/template", baseUrl);

    if (!url || !templateId || !apiToken) {
      throw new Error(
        `Failed to send OTP - missing OTP mailer configuration: ${JSON.stringify({ baseUrl, templateId, apiToken })}`,
      );
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiToken,
      },
      body: JSON.stringify({
        from: { address: "no_reply@quizgen.app", name: "Quizgen" },
        to: [{ email_address: { address: email } }],
        template_key: templateId,
        merge_info: {
          otp: token,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send OTP: ${error}`);
    }
  },
});

const convexAuthConfig = convexAuth({
  providers: [ZeptomailOTP],
});

export const { auth, signOut, store } = convexAuthConfig;
const rawSignIn = convexAuthConfig.signIn;

export const signIn = action({
  args: {
    provider: v.optional(v.string()),
    params: v.optional(v.any()),
    verifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    calledBy: v.optional(v.string()),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (needsTurnstile(args)) {
      if (!args.turnstileToken?.trim()) {
        throw new Error("Security verification required");
      }

      await verifyTurnstile(args.turnstileToken.trim());
    }

    if (
      !("_handler" in rawSignIn) ||
      typeof rawSignIn._handler !== "function"
    ) {
      throw new Error("Auth sign-in handler is unavailable");
    }

    return await rawSignIn._handler(ctx, {
      provider: args.provider,
      params: args.params,
      verifier: args.verifier,
      refreshToken: args.refreshToken,
      calledBy: args.calledBy,
    });
  },
});
