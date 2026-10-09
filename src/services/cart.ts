import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { clampToStock, parseCart, serializeCart, type CartLine } from "@/domain/cart";
import { listStoreProducts, type StoreProduct } from "@/services/store-products";

export type { CartLine };

// One basket per shop: stores are reachable on any host through /s/<slug>,
// so a shared cookie name would mix baskets between shops.
export function cartCookieName(shopId: string): string {
  return `cart_${shopId}`;
}

export async function readCart(shopId: string): Promise<CartLine[]> {
  return parseCart((await cookies()).get(cartCookieName(shopId))?.value);
}

// The basket as it can be bought right now: the cookie's lines checked
// against this shop's active products, quantities capped at current stock.
// Archived, sold out, other shops' and forged lines are dropped. The basket
// page, the nav badge, every basket action and checkout all use this, so
// they always agree. `saved` is the raw cookie, `products` the shop's
// active products read in the same call (for pricing).
// Cached per request and shop, so the layout and the page share one query.
// Actions must not rely on a read after their own write in the same request.
export const loadBasket = cache(
  async (shopId: string): Promise<{ saved: CartLine[]; lines: CartLine[]; products: StoreProduct[] }> => {
    const [saved, products] = await Promise.all([readCart(shopId), listStoreProducts(shopId)]);
    return { saved, lines: clampToStock(saved, products), products };
  },
);

export async function readBuyableCart(shopId: string): Promise<CartLine[]> {
  return (await loadBasket(shopId)).lines;
}

// Server actions and route handlers only (cookies are read-only while rendering).
export async function writeCart(shopId: string, lines: CartLine[]): Promise<void> {
  const store = await cookies();
  const name = cartCookieName(shopId);
  if (lines.length === 0) {
    store.delete(name);
    return;
  }
  store.set(name, serializeCart(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
