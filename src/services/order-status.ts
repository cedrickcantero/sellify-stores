import "server-only";
import { forShop, type SaleWithItems } from "@/data";
import { decodeOrderMetadata } from "@/domain/order-metadata";
import type { PaymentGateway } from "@/payments/gateway";
import { getPaymentGateway } from "@/payments/stripe";

export type OrderStatus =
  | { state: "confirmed"; sale: SaleWithItems }
  | { state: "pending" }
  | { state: "unknown" };

// What the success page may say about a Stripe session id from the URL. The
// redirect alone proves nothing: a recorded sale of this shop is the proof
// (confirmed); otherwise Stripe is asked, and only a paid session created
// by this app for this shop counts as pending (payment received, waiting for
// the webhook). Anything else is unknown.
export async function getOrderStatus(
  shopId: string,
  sessionId: string | undefined,
  deps: { gateway?: PaymentGateway } = {},
): Promise<OrderStatus> {
  if (!sessionId || sessionId.length > 200) return { state: "unknown" };

  const sale = await forShop(shopId).sales.findByStripeSession(sessionId);
  if (sale) return { state: "confirmed", sale };

  const session = await (deps.gateway ?? getPaymentGateway()).retrieveSession(sessionId);
  if (!session || session.paymentStatus !== "paid") return { state: "unknown" };
  const order = decodeOrderMetadata(session.metadata);
  if (!order.ok || order.value.shopId !== shopId) return { state: "unknown" };
  return { state: "pending" };
}
