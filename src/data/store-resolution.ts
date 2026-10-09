import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { customDomain, shop } from "./schema";

// Unscoped lookup for store resolution only (slugs use resolveShopBySlug):
// the shop behind a verified custom domain. A pending or failed domain
// resolves to nothing.
export async function resolveShopByVerifiedHostname(
  hostname: string,
): Promise<{ shopId: string; slug: string } | null> {
  const rows = await db
    .select({ shopId: shop.id, slug: shop.slug })
    .from(customDomain)
    .innerJoin(shop, eq(shop.id, customDomain.shopId))
    .where(and(eq(customDomain.hostname, hostname.toLowerCase()), eq(customDomain.status, "verified")))
    .limit(1);
  return rows[0] ?? null;
}
