import "server-only";
import { forShop, type SaleWithItems } from "@/data";
import { decodeOrderMetadata } from "@/domain/order-metadata";
import { rateLimit } from "@/services/abuse";
import type { PaymentGateway } from "@/payments/gateway";
import { getPaymentGateway } from "@/payments/stripe";

// Stripe's own id shape; anything else never reaches Stripe.
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{1,200}$/;

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
  deps: {
    gateway?: PaymentGateway;
    /** The caller's IP, for the Stripe lookup limit. */
    ip?: string;
    lookupLimit?: { capacity: number; refillPerMinute: number };
  } = {},
): Promise<OrderStatus> {
  if (!sessionId || !SESSION_ID.test(sessionId)) return { state: "unknown" };

  const sale = await forShop(shopId).sales.findByStripeSession(sessionId);
  if (sale) return { state: "confirmed", sale };

  // Only the Stripe lookup is limited per IP (the page polls while the
  // webhook is pending). Past the limit the page keeps saying "confirming"
  // and the sale shows up as soon as the webhook has recorded it.
  const allowed = await rateLimit(
    `order-status:ip:${deps.ip ?? "unknown"}`,
    deps.lookupLimit ?? { capacity: 30, refillPerMinute: 30 },
  );
  if (!allowed) return { state: "pending" };

  const session = await (deps.gateway ?? getPaymentGateway()).retrieveSession(sessionId);
  if (!session || session.paymentStatus !== "paid") return { state: "unknown" };
  const order = decodeOrderMetadata(session.metadata);
  if (!order.ok || order.value.shopId !== shopId) return { state: "unknown" };
  return { state: "pending" };
}
