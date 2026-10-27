import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/server/db/prisma";

/**
 * Only the shop owner signs in, with a username. Better Auth still requires an email, so the
 * account gets a placeholder address that is never shown. Sign-up is disabled; the account is
 * created by `npm run db:seed`.
 */
export const auth = betterAuth({
  appName: "Bích Ngọc Florist",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Admin pages call getSession on every navigation; the signed cookie answers it without a
    // database round trip. A sign-out from another device can take up to maxAge to show here.
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: { "/sign-in/username": { window: 60, max: 5 } },
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 }), nextCookies()],
});

export function placeholderEmail(username: string) {
  return `${username}@users.bichngoc.invalid`;
}
