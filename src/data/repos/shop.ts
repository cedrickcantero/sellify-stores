import { eq } from "drizzle-orm";
import { db } from "../db";
import { shop } from "../schema";

export type Shop = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export type ShopRepo = {
  get(): Promise<Shop | null>;
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
  };
}
