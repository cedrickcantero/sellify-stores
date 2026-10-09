import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { member, shop, user } from "../schema";

export type Shop = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export type ShopRepo = {
  get(): Promise<Shop | null>;
  /** The email of the shop's owner (the earliest owner member), or null. */
  ownerEmail(): Promise<string | null>;
};

export function shopRepo(shopId: string): ShopRepo {
  return {
    async get() {
      const rows = await db
        .select({ id: shop.id, slug: shop.slug, name: shop.name, timezone: shop.timezone })
        .from(shop)
        .where(eq(shop.id, shopId))
        .limit(1);
      return rows[0] ?? null;
    },
    async ownerEmail() {
      const rows = await db
        .select({ email: user.email })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(eq(member.organizationId, shopId), eq(member.role, "owner")))
        .orderBy(asc(member.createdAt))
        .limit(1);
      return rows[0]?.email ?? null;
    },
  };
}
