import { eq } from "drizzle-orm";
import { db } from "./db";
import { organization, shop } from "./schema";

// The only unscoped shop lookup: store resolution and slug uniqueness.
export async function resolveShopBySlug(slug: string): Promise<{ shopId: string } | null> {
  const rows = await db.select({ shopId: shop.id }).from(shop).where(eq(shop.slug, slug)).limit(1);
  return rows[0] ?? null;
}

// Creates the shop row for an organization that was just created. The shop
// id is the organization id.
export async function insertShop(input: {
  organizationId: string;
  slug: string;
  name: string;
  timezone?: string;
}): Promise<{ shopId: string }> {
  const [row] = await db
    .insert(shop)
    .values({
      id: input.organizationId,
      slug: input.slug,
      name: input.name,
      timezone: input.timezone,
    })
    .returning({ shopId: shop.id });
  return row;
}

// Rolls back a half-finished sign-up. Deleting the organization also deletes
// its members, invitations and shop row through foreign key cascades.
export async function deleteOrganization(organizationId: string): Promise<void> {
  await db.delete(organization).where(eq(organization.id, organizationId));
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  // Drizzle wraps driver errors; walk the cause chain for the Postgres code.
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object" && "code" in current && current.code === "23505") {
      return true;
    }
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return false;
}
