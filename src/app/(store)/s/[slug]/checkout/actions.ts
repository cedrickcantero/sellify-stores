"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { basketAdjusted, clampToStock } from "@/domain/cart";
import { PaymentsNotConfiguredError } from "@/payments/gateway";
import { clientIp, isHoneypotTripped, rateLimit } from "@/services/abuse";
import { loadBasket, writeCart } from "@/services/cart";
import { createCheckout } from "@/services/checkout";
import { listStoreProducts } from "@/services/store-products";
import { storeHref } from "@/store-ui/store-href";
import { requireLiveStore } from "../store-context";

// Starts Stripe Checkout for the basket. The shop comes from the store
// address (requireLiveStore) and the basket from the customer's own cookie;
// prices are read from the database inside createCheckout, never from here.

export type CheckoutState = { message?: string };

const MESSAGES = {
  tooMany: "Too many attempts. Wait a minute, then try again.",
  unavailable: "Checkout is not available right now. Please try again later.",
  failed: "We could not start checkout. Please try again.",
} as const;

export async function startCheckout(slug: string, _previous: CheckoutState, form: FormData): Promise<CheckoutState> {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 100) return { message: MESSAGES.failed };
  const { shopId, basePath, preview } = await requireLiveStore(slug, "shop");
  const basket = storeHref(basePath, "/basket", preview);
  const changed = storeHref(basePath, "/basket", preview, "stock=changed");

  // A bot filled the hidden field: send it back, create nothing.
  if (isHoneypotTripped(form)) redirect(basket);

  const requestHeaders = await headers();
  if (!(await rateLimit(`checkout:ip:${clientIp(requestHeaders)}`, { capacity: 10, refillPerMinute: 2 }))) {
    return { message: MESSAGES.tooMany };
  }

  // What can be bought right now. If the basket as saved differs (stock
  // dropped, a product was removed), save the corrected basket and show the
  // customer, before any payment is started.
  const { saved, lines } = await loadBasket(shopId);
  if (basketAdjusted(saved, lines)) {
    await writeCart(shopId, lines);
    redirect(changed);
  }
  if (lines.length === 0) redirect(basket);

  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  const origin = `${proto}://${requestHeaders.get("host") ?? "localhost:3000"}`;
  let result;
  try {
    result = await createCheckout(shopId, lines, {
      success: `${origin}${storeHref(basePath, "/checkout/success", preview)}`,
      cancel: `${origin}${basket}`,
    });
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      console.error(error.message);
      return { message: MESSAGES.unavailable };
    }
    console.error("Could not create a Stripe Checkout session.", error);
    return { message: MESSAGES.failed };
  }

  if (!result.ok) {
    // Something ran out since the basket was read. Fix the basket from fresh
    // stock and show the customer; nothing was charged.
    const fresh = clampToStock(lines, await listStoreProducts(shopId));
    await writeCart(shopId, fresh);
    redirect(changed);
  }
  redirect(result.value.url);
}
