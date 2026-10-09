import "server-only";
import { forShop } from "@/data";
import type { CartLine } from "@/domain/cart";
import { encodeOrderMetadata, type OrderLine } from "@/domain/order-metadata";
import { err, ok, type Result } from "@/domain/result";
import type { PaymentGateway } from "@/payments/gateway";
import { getPaymentGateway } from "@/payments/stripe";

const CURRENCY = "eur";

function withSessionId(successUrl: string): string {
  return `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

// Starts a Stripe Checkout for the basket. The basket holds only product ids
// and quantities: titles and prices are read from this shop's products now,
// so a client can never set a price. Any line that is not in stock (sold
// out, short, archived or another shop's) stops checkout and comes back in
// `outOfStock` so the basket can be updated; nothing is created then. The
// success url gets Stripe's session id placeholder appended. No stock is
// taken here; fulfilOrder does that when the payment completes.
export async function createCheckout(
  shopId: string,
  lines: CartLine[],
  urls: { success: string; cancel: string },
  deps: { gateway?: PaymentGateway } = {},
): Promise<Result<{ url: string }, { outOfStock: string[] }>> {
  if (lines.length === 0) return err({ outOfStock: [] });

  const products = new Map((await forShop(shopId).products.list()).map((p) => [p.id, p]));
  const short = lines.filter(({ productId, qty }) => (products.get(productId)?.stockQty ?? 0) < qty);
  if (short.length > 0) return err({ outOfStock: short.map((l) => l.productId) });

  const priced: (OrderLine & { title: string })[] = lines.map(({ productId, qty }) => {
    const product = products.get(productId)!;
    return { productId, qty, unitPrice: product.price, title: product.title };
  });

  const gateway = deps.gateway ?? getPaymentGateway();
  const session = await gateway.createSession({
    currency: CURRENCY,
    lines: priced.map((l) => ({ name: l.title, unitAmount: l.unitPrice, quantity: l.qty })),
    metadata: encodeOrderMetadata(shopId, priced),
    clientReferenceId: shopId,
    successUrl: withSessionId(urls.success),
    cancelUrl: urls.cancel,
  });
  return ok({ url: session.url });
}
