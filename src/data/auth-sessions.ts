import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import type { Shop } from "./repos/shop";
import { member, session, shop } from "./schema";

// Helpers Better Auth hooks and the sign-up use case need to keep the
// session's active organization (the active shop) set.

export async function firstOrganizationIdForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

export async function setSessionActiveOrganization(
  sessionToken: string,
  organizationId: string,
): Promise<void> {
  await db
    .update(session)
    .set({ activeOrganizationId: organizationId })
    .where(eq(session.token, sessionToken));
}

// The session's active organization is only trusted if the user is still a
// member of it: returns that shop, or null when the user is not a member.
export async function activeShopForMember(
  userId: string,
  organizationId: string,
): Promise<Shop | null> {
  const rows = await db
    .select({ id: shop.id, slug: shop.slug, name: shop.name, timezone: shop.timezone })
    .from(shop)
    .innerJoin(member, eq(member.organizationId, shop.id))
    .where(and(eq(shop.id, organizationId), eq(member.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
