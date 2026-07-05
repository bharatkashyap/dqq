"use node";

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

export async function sendOTP({
  email,
  otp,
  magicLinkUrl,
}: {
  email: string;
  otp: string;
  magicLinkUrl?: string;
}) {
  const baseURL = env.ZEPTOMAIL_URL;
  const token = env.ZEPTOMAIL_API_TOKEN;
  const template_id = env.ZEPTOMAIL_TEMPLATE_ID;

  if (!baseURL || !token || !template_id) {
    console.warn(
      "OTP sender configuration missing, simulating email send for: ",
      email,
      " OTP: ",
      otp,
    );
    return;
  }

  const url = new URL("/v1.1/email/template", baseURL);

  const response = await fetch(url.href, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      template_key: template_id,
      from: { address: "no-reply@quizgen.app", name: "Bharat" },
      to: [{ email_address: { address: email } }],
      merge_info: { otp, magic_link_url: magicLinkUrl },
    }),
  });

  if (!response.ok) {
    console.error("Failed to send ZeptoMail email", await response.text());
    throw new Error("Failed to send email via ZeptoMail");
  }
}
