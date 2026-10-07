import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { authDatabaseAdapter, firstOrganizationIdForUser } from "@/data";

// An organization is a shop and its members are the shop's staff. Shops are
// created by the sign-up use case (services/register-shop-owner), not by
// users calling the organization API directly.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authDatabaseAdapter,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    session: {
      create: {
        // Logging in makes the user's shop the active one.
        before: async (session) => {
          const organizationId = await firstOrganizationIdForUser(session.userId);
          return { data: { ...session, activeOrganizationId: organizationId } };
        },
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: false,
    }),
    // Must stay last so Set-Cookie headers reach Next.js server actions.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
