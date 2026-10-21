import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { sendEmail, emailEnabled } from "@/server/email";
import { hashPassword, verifyPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/server/password";
import { APP_NAME } from "@/lib/brand";

const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  appName: APP_NAME,
  // On Vercel this defaults to the project's main address (your custom domain once added).
  baseURL:
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: vercelOrigins,
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  telemetry: { enabled: false },

  emailAndPassword: {
    enabled: true,
    // Accounts are only created by Admins (or the first-run setup screen).
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    password: { hash: hashPassword, verify: verifyPassword },
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    onPasswordReset: async ({ user }) => {
      await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    },
    sendResetPassword: async ({ user, url }) => {
      if (!emailEnabled()) return;
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // stay signed in for 7 days
    updateAge: 60 * 60 * 24, // extend the session once a day while in use
    // No cookie cache: every request checks the database, so deactivating a
    // user or changing their role takes effect immediately.
  },

  user: {
    additionalFields: {
      // input: false → users can never set these themselves through the auth API.
      role: { type: "string", required: false, defaultValue: "EMPLOYEE", input: false },
      isActive: { type: "boolean", required: false, defaultValue: true, input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  // Endpoints this app doesn't use are switched off to keep the surface small.
  disabledPaths: [
    "/sign-up/email",
    "/update-user",
    "/change-email",
    "/change-password",
    "/delete-user",
    "/delete-user/callback",
    "/sign-in/social",
    "/link-social",
    "/unlink-account",
    "/send-verification-email",
    "/verify-email",
  ],

  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/reset-password": { window: 60 * 60, max: 10 },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Deactivated users can't sign in, even with the right password.
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          if (!user?.isActive) {
            throw new APIError("FORBIDDEN", { message: "This account has been deactivated. Please contact your admin." });
          }
        },
      },
    },
  },

  plugins: [nextCookies()],
});
