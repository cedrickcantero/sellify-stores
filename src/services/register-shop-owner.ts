import "server-only";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/auth/server";
import { insertShop, isUniqueViolation, resolveShopBySlug, setSessionActiveOrganization } from "@/data";
import { err, ok, type Result } from "@/domain/result";
import { slugCandidates, slugify } from "@/domain/slug";

export const registerShopOwnerInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(128),
  shopName: z.string().trim().min(1).max(80),
});

export type RegisterShopOwnerInput = z.input<typeof registerShopOwnerInput>;

export type RegisterShopOwnerError = "invalid" | "email_taken";

export type RegisteredShopOwner = { userId: string; shopId: string; slug: string };

const MAX_SLUG_ATTEMPTS = 20;

// Sign-up: creates the user (and their session cookie when called from a
// server action), an organization for the shop with the user as owner, and
// the shop row whose id is the organization id. The new session is pointed
// at the shop so the owner lands in their backend straight away.
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
  if (!signUp.token) return err("email_taken");
  const userId = signUp.user.id;

  const { shopId, slug } = await createShopForOwner(userId, shopName);
  await setSessionActiveOrganization(signUp.token, shopId);
  return ok({ userId, shopId, slug });
}

async function createShopForOwner(
  userId: string,
  shopName: string,
): Promise<{ shopId: string; slug: string }> {
  const candidates = slugCandidates(slugify(shopName));
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = candidates.next().value;
    if (await resolveShopBySlug(slug)) continue;
    try {
      // Called without request headers, so Better Auth treats it as a server
      // action on behalf of userId and makes them the owner.
      const organization = await auth.api.createOrganization({
        body: { name: shopName, slug, userId },
      });
      return await insertShop({ organizationId: organization.id, slug, name: shopName }).then(
        ({ shopId }) => ({ shopId, slug }),
      );
    } catch (error) {
      // Another sign-up took this slug between the check and the insert.
      if (isUniqueViolation(error) || isOrganizationSlugTaken(error)) continue;
      throw error;
    }
  }
  throw new Error(`Could not find a free slug for shop "${shopName}"`);
}

function isOrganizationSlugTaken(error: unknown): boolean {
  return isAPIError(error) && error.body?.code === "ORGANIZATION_ALREADY_EXISTS";
}
