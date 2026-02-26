import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { env } from "@/lib/env";
import { config } from "./config";
import { db } from "./db/client";
import { schema } from "./db/schema";

/**
 * Send magic link email via Resend.
 * Falls back to console logging if RESEND_API_KEY is not set.
 */
async function sendMagicLinkEmail({
  email,
  url,
  token,
}: {
  email: string;
  url: string;
  token: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    // Fallback: log to console
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║         🔗 MAGIC LINK LOGIN             ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║ Email: ${email}`);
    console.log(`║ Token: ${token}`);
    console.log(`║ URL:   ${url}`);
    console.log("╚══════════════════════════════════════════╝\n");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "OmniChatAgent <onboarding@resend.dev>",
    to: email,
    subject: "Sign in to OmniChatAgent",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">Sign in to OmniChatAgent</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">Click the button below to sign in. This link expires in 5 minutes.</p>
        <a href="${url}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          ✉️ Sign In to OmniChatAgent
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">OmniChatAgent — Multi-Agent AI Chat</p>
      </div>
    `,
  });

  if (error) {
    console.error("[Magic Link] Failed to send email via Resend:", error);
    // Fallback to console on error
    console.log(`[Magic Link] Fallback URL: ${url}`);
  } else {
    console.log(`[Magic Link] Email sent to ${email} via Resend`);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [
    "http://localhost:3000",
    // Vercel URL for preview branches
    ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
    config.appUrl,
  ],
  secret: env.AUTH_SECRET,

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes - reduces database queries for session validation
    },
  },

  socialProviders: (() => {
    const googleId = env.AUTH_GOOGLE_ID;
    const googleSecret = env.AUTH_GOOGLE_SECRET;
    const githubId = env.AUTH_GITHUB_ID;
    const githubSecret = env.AUTH_GITHUB_SECRET;
    const vercelId = env.VERCEL_APP_CLIENT_ID;
    const vercelSecret = env.VERCEL_APP_CLIENT_SECRET;

    const google =
      typeof googleId === "string" &&
      googleId.length > 0 &&
      typeof googleSecret === "string" &&
      googleSecret.length > 0
        ? { clientId: googleId, clientSecret: googleSecret }
        : undefined;

    const github =
      typeof githubId === "string" &&
      githubId.length > 0 &&
      typeof githubSecret === "string" &&
      githubSecret.length > 0
        ? {
            clientId: githubId,
            clientSecret: githubSecret,
            scope: ["user:email"],
          }
        : undefined;

    const vercel =
      typeof vercelId === "string" &&
      vercelId.length > 0 &&
      typeof vercelSecret === "string" &&
      vercelSecret.length > 0
        ? { clientId: vercelId, clientSecret: vercelSecret }
        : undefined;

    return { google, github, vercel } as const;
  })(),

  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: sendMagicLinkEmail,
      expiresIn: 300, // 5 minutes
    }),
    admin({
      defaultRole: "user",
    }),
  ],
});

// Infer session type from the auth instance for type safety
export type Session = typeof auth.$Infer.Session;

