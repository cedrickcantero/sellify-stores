import "server-only";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { clearSessionCookies } from "@/auth/cookies";
import { auth } from "@/auth/server";
import {
  deleteOrganization,
  insertShop,
  isUniqueViolation,
  resolveShopBySlug,
  setSessionActiveOrganization,
} from "@/data";
import { err, ok, type Result } from "@/domain/result";
import { slugCandidates, slugify } from "@/domain/slug";

export const registerShopOwnerInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(128),
  shopName: z.string().trim().min(1).max(80),
});

export type RegisterShopOwnerInput = z.input<typeof registerShopOwnerInput>;

// invalid: input failed validation. email_taken: the email already has an
// account. signup_failed: anything else went wrong; nothing is left behind,
// so the owner can simply try again.
export type RegisterShopOwnerError = "invalid" | "email_taken" | "signup_failed";

export type RegisteredShopOwner = { userId: string; shopId: string; slug: string };

const MAX_SLUG_ATTEMPTS = 20;

// Sign-up: creates the user (and their session cookie when called from a
// server action), an organization for the shop with the user as owner, and
// the shop row whose id is the organization id. The new session is pointed
// at the shop so the owner lands in their backend straight away. If any step
// after creating the user fails, the user, organization and session cookie
// are removed again so the email is free to sign up once more.
export async function registerShopOwner(
  input: RegisterShopOwnerInput,
): Promise<Result<RegisteredShopOwner, RegisterShopOwnerError>> {
  const parsed = registerShopOwnerInput.safeParse(input);
  if (!parsed.success) return err("invalid");
  const { name, email, password, shopName } = parsed.data;

  let signUp: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    signUp = await auth.api.signUpEmail({ body: { name, email, password } });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return err("email_taken");
    }
    throw error;
  }
  const userId = signUp.user.id;
  // The organization created so far, if any, so a failure at any later step
  // can remove it too.
  const created: CreatedOrganization = {};

  try {
    // Better Auth returns no token when it did not sign the new user in.
    if (!signUp.token) throw new Error("Sign-up returned no session token");
    const { shopId, slug } = await createShopForOwner(userId, shopName, created);
    await setSessionActiveOrganization(signUp.token, shopId);
    return ok({ userId, shopId, slug });
  } catch (error) {
    console.error("registerShopOwner: rolling back sign-up", error);
    await rollBack(userId, created);
    return err("signup_failed");
  }
}

type CreatedOrganization = { organizationId?: string };

async function rollBack(userId: string, created: CreatedOrganization): Promise<void> {
  // Deleting the organization also deletes its shop and members.
  if (created.organizationId) await deleteOrganization(created.organizationId);
  const ctx = await auth.$context;
  // Removes the user's sessions, accounts and memberships as well.
  await ctx.internalAdapter.deleteUser(userId);
  await clearSessionCookies();
}

async function createShopForOwner(
  userId: string,
  shopName: string,
  created: CreatedOrganization,
): Promise<{ shopId: string; slug: string }> {
  const candidates = slugCandidates(slugify(shopName));
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = candidates.next().value;
    if (await resolveShopBySlug(slug)) continue;

    let organizationId: string;
    try {
      // Called without request headers, so Better Auth treats it as a server
      // action on behalf of userId and makes them the owner.
      const organization = await auth.api.createOrganization({
        body: { name: shopName, slug, userId },
      });
      organizationId = organization.id;
      created.organizationId = organizationId;
    } catch (error) {
      // Another sign-up took this slug between the check and the insert.
      if (isOrganizationSlugTaken(error) || isUniqueViolation(error)) continue;
      throw error;
    }

    try {
      const { shopId } = await insertShop({ organizationId, slug, name: shopName });
      return { shopId, slug };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another shop took this slug: drop this organization, try the next.
      await deleteOrganization(organizationId);
      created.organizationId = undefined;
    }
  }
  throw new Error(`Could not find a free slug for shop "${shopName}"`);
}

function isOrganizationSlugTaken(error: unknown): boolean {
  return isAPIError(error) && error.body?.code === "ORGANIZATION_ALREADY_EXISTS";
}
