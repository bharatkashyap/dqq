import type { AuthConfig } from "convex/server";

const domain = process.env.CONVEX_SITE_URL;

if (!domain) {
  throw new Error("Missing CONVEX_SITE_URL");
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
