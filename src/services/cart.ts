import "server-only";
import { cookies } from "next/headers";
import { parseCart, serializeCart, type CartLine } from "@/domain/cart";

export type { CartLine };

// One basket per shop: stores are reachable on any host through /s/<slug>,
// so a shared cookie name would mix baskets between shops.
export function cartCookieName(shopId: string): string {
  return `cart_${shopId}`;
}

export async function readCart(shopId: string): Promise<CartLine[]> {
  return parseCart((await cookies()).get(cartCookieName(shopId))?.value);
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
